import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  META_VISION_SYSTEM_PROMPT,
  META_VISION_USER_PROMPT,
} from "@/lib/ai/prompts";
import { embedTexts } from "@/lib/ai/embeddings";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs"; // Required for Buffer / Service Role
export const maxDuration = 60;

// --- Types & Validation ---
const ExtractedProductSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().nonnegative().nullable().catch(null),
  category: z.string().max(50).default("Otros"),
  description: z.string().max(300).nullable().catch(null),
});

const MetaOutputSchema = z.object({
  store_name: z.string().nullable().catch(null),
  currency: z.string().length(3).default("PEN").catch("PEN"),
  items: z.array(ExtractedProductSchema).max(200),
});

type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;

interface ChatCompletionResponse {
  choices: { message: { content: string } }[];
}

// --- Clients (lazy: module import must stay side-effect free for `next build`) ---
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// --- Helpers ---
// Allowlist: client-supplied MIME is spoofable, so only raster formats we
// can safely store/serve are accepted (SVG would allow stored XSS via the
// public bucket). Extension always comes from this map, never from input.
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function verifyClaimToken(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashClaimToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

async function callMetaVision(
  dataUrl: string,
): Promise<z.infer<typeof MetaOutputSchema>> {
  const res = await fetch(
    `${process.env.META_API_BASE_URL}/chat/completions`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.META_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.META_VISION_MODEL,
        temperature: 0.0, // Deterministic extraction
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "menu_extraction",
            schema: {
              type: "object",
              properties: {
                store_name: { type: ["string", "null"] },
                currency: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      price: { type: ["number", "null"] },
                      category: { type: "string" },
                      description: { type: ["string", "null"] },
                    },
                    required: ["name", "price", "category", "description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["store_name", "currency", "items"],
              additionalProperties: false,
            },
          },
        },
        messages: [
          { role: "system", content: META_VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: META_VISION_USER_PROMPT },
              // Meta Chat Completions uses the OpenAI image-part shape
              // (input_image belongs to the Responses API and 400s here)
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as ChatCompletionResponse;
  const rawContent = data.choices[0]?.message?.content ?? "{}";

  // Defensive parsing: strip markdown fences if model disobeys
  const cleanJson = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  return MetaOutputSchema.parse(JSON.parse(cleanJson));
}

// Product embeddings share the provider+model with query search
// (lib/ai/embeddings.ts): Meta Llama when META_* is set, else OpenAI.
// Graceful degradation: null entries save the product without a vector.
async function generateEmbeddings(
  texts: string[],
): Promise<(number[] | null)[]> {
  return embedTexts(texts);
}

// --- Route Handler ---
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  // Tracked so any failure can remove the orphaned Storage blob.
  let uploadedPath: string | null = null;
  let supabaseRef: ReturnType<typeof getSupabase> | null = null;
  try {
    const rate = checkRateLimit(`upload:${clientIp(req)}`, 5, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Demasiadas subidas. Espera un momento e intenta de nuevo." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const tiendaId = formData.get("tiendaId") as string | null;
    const nombreForm = formData.get("nombre") as string | null;
    const claimToken = formData.get("claimToken") as string | null;
    const lat = parseFloat(formData.get("lat") as string);
    const lng = parseFloat(formData.get("lng") as string);

    // 1. Validation
    if (!image || !ALLOWED_IMAGE_TYPES.has(image.type))
      return NextResponse.json(
        { error: "Se requiere una imagen JPG, PNG o WebP válida" },
        { status: 400 },
      );
    if (image.size > 8 * 1024 * 1024)
      return NextResponse.json({ error: "La imagen supera los 8 MB" }, { status: 413 });
    if (
      isNaN(lat) ||
      lat < -90 ||
      lat > 90 ||
      isNaN(lng) ||
      lng < -180 ||
      lng > 180
    )
      return NextResponse.json(
        { error: "Coordenadas de ubicación inválidas" },
        { status: 400 },
      );

    const supabase = getSupabase();
    // supabaseRef lets the outer catch clean up the uploaded blob.
    supabaseRef = supabase;

    // 2. Parallel Execution: Meta Inference + Storage Upload (Low Latency)
    const dataUrlPromise = fileToDataUrl(image);
    const fileName = `${crypto.randomUUID()}.${ALLOWED_IMAGE_TYPES.get(image.type)!}`;

    const [extracted, storageResult] = await Promise.all([
      dataUrlPromise.then(callMetaVision),
      supabase.storage
        .from("menus")
        .upload(fileName, image, { contentType: image.type, upsert: false }),
    ]);

    if (storageResult.error)
      throw new Error(`Storage upload failed: ${storageResult.error.message}`);
    uploadedPath = storageResult.data?.path ?? null;

    if (extracted.items.length === 0) {
      if (uploadedPath)
        await supabase.storage.from("menus").remove([uploadedPath]);
      return NextResponse.json(
        { error: "No se detectaron productos en la imagen" },
        { status: 422 },
      );
    }

    const fotoMenuUrl = storageResult.data
      ? supabase.storage.from("menus").getPublicUrl(storageResult.data.path)
          .data.publicUrl
      : null;

    // 3a. Ownership: updating an existing tienda requires its claim token.
// The service_role client bypasses RLS, so this check is the only guard
// against overwriting someone else's tienda. Legacy tiendas without a
// hash are claimed by the first token presented.
let newClaimToken: string | null = null;
if (tiendaId) {
  if (!claimToken)
    return NextResponse.json(
      { error: "Falta el código de tu tienda para actualizarla" },
      { status: 401 },
    );
  const { data: existing } = await supabase
    .from("tiendas")
    .select("claim_hash")
    .eq("id", tiendaId)
    .single();
  if (!existing)
    return NextResponse.json(
      { error: "No se encontró la tienda indicada" },
      { status: 404 },
    );
  if (existing.claim_hash) {
    if (!verifyClaimToken(claimToken, existing.claim_hash))
      return NextResponse.json(
        { error: "El código de tienda no es válido" },
        { status: 403 },
      );
  } else {
    await supabase
      .from("tiendas")
      .update({ claim_hash: hashClaimToken(claimToken) })
      .eq("id", tiendaId)
      .is("claim_hash", null);
  }
} else {
  newClaimToken = randomBytes(32).toString("base64url");
}

// 3. Upsert Tienda (PostGIS Point: Note lng is X, lat is Y)
    const tiendaPayload = {
      nombre: nombreForm || extracted.store_name || "Mi Tienda",
      foto_menu_url: fotoMenuUrl,
      ubicacion: `POINT(${lng} ${lat})`,
      updated_at: new Date().toISOString(),
    };

    const { data: tienda, error: tiendaError } = tiendaId
      ? await supabase
          .from("tiendas")
          .update(tiendaPayload)
          .eq("id", tiendaId)
          .select("id")
          .single()
      : await supabase
          .from("tiendas")
          .insert({ ...tiendaPayload, claim_hash: hashClaimToken(newClaimToken!) })
          .select("id")
          .single();

    if (tiendaError || !tienda)
      throw new Error(`Tienda upsert failed: ${tiendaError?.message}`);

    // 4. Batch Embeddings (Single API call for all items)
    const textsToEmbed = extracted.items.map(
      (p) => `${p.name}. ${p.description ?? ""} [${p.category}]`,
    );
    const embeddings = await generateEmbeddings(textsToEmbed);

    // 5. Batch Upsert Productos
    const productosRows = extracted.items.map(
      (p: ExtractedProduct, i: number) => ({
        tienda_id: tienda.id,
        nombre: p.name,
        precio: p.price,
        moneda: extracted.currency,
        categoria: p.category,
        descripcion: p.description,
        embedding: embeddings[i] ? `[${embeddings[i]!.join(",")}]` : null,
        embedding_status: embeddings[i] ? "ready" : "pending",
        embedding_attempts: embeddings[i] ? 0 : 1,
        updated_at: new Date().toISOString(),
      }),
    );

    const { error: prodError } = await supabase
      .from("productos")
      .upsert(productosRows, { onConflict: "tienda_id,nombre" });

    if (prodError)
      throw new Error(`Productos upsert failed: ${prodError.message}`);

    logInfo("upload.ok", {
      request_id: requestId,
      route: "/api/upload",
      ms: Math.round(performance.now() - startedAt),
      productos: productosRows.length,
    });

    return NextResponse.json(
      {
        success: true,
        tienda_id: tienda.id,
        productos_insertados: productosRows.length,
        // Returned only at creation: the merchant must save it to update later.
        ...(newClaimToken ? { claim_token: newClaimToken } : {}),
        data: extracted,
      },
      { status: 201 },
    );
  } catch (error) {
    // Best-effort orphan cleanup: never mask the original error.
    if (uploadedPath && supabaseRef) {
      await supabaseRef.storage
        .from("menus")
        .remove([uploadedPath])
        .catch(() => undefined);
    }
    logError("upload.failed", {
      request_id: requestId,
      route: "/api/upload",
      ms: Math.round(performance.now() - startedAt),
      error,
    });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: "La IA devolvió una respuesta inválida. Intenta de nuevo." },
        { status: 502 },
      );
    return NextResponse.json(
      { error: "Error interno del servidor. Intenta más tarde." },
      { status: 500 },
    );
  }
}
