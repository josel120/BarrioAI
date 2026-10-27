import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  META_VISION_SYSTEM_PROMPT,
  META_VISION_USER_PROMPT,
} from "@/lib/ai/prompts";

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

async function generateEmbeddings(
  texts: string[],
): Promise<(number[] | null)[]> {
  if (!process.env.OPENAI_API_KEY || texts.length === 0)
    return texts.map(() => null);

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) return texts.map(() => null); // Graceful degradation: save without vector
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// --- Route Handler ---
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const tiendaId = formData.get("tiendaId") as string | null;
    const nombreForm = formData.get("nombre") as string | null;
    const lat = parseFloat(formData.get("lat") as string);
    const lng = parseFloat(formData.get("lng") as string);

    // 1. Validation
    if (!image || !image.type.startsWith("image/"))
      return NextResponse.json(
        { error: "Valid image required" },
        { status: 400 },
      );
    if (image.size > 8 * 1024 * 1024)
      return NextResponse.json({ error: "Image exceeds 8MB" }, { status: 413 });
    if (
      isNaN(lat) ||
      lat < -90 ||
      lat > 90 ||
      isNaN(lng) ||
      lng < -180 ||
      lng > 180
    )
      return NextResponse.json(
        { error: "Invalid geolocation coordinates" },
        { status: 400 },
      );

    const supabase = getSupabase();

    // 2. Parallel Execution: Meta Inference + Storage Upload (Low Latency)
    const dataUrlPromise = fileToDataUrl(image);
    const fileName = `${crypto.randomUUID()}.${image.type.split("/")[1] ?? "jpg"}`;

    const [extracted, storageResult] = await Promise.all([
      dataUrlPromise.then(callMetaVision),
      supabase.storage
        .from("menus")
        .upload(fileName, image, { contentType: image.type, upsert: false }),
    ]);

    if (extracted.items.length === 0)
      return NextResponse.json(
        { error: "No products detected in image" },
        { status: 422 },
      );

    const fotoMenuUrl = storageResult.data
      ? supabase.storage.from("menus").getPublicUrl(storageResult.data.path)
          .data.publicUrl
      : null;

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
          .insert(tiendaPayload)
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
        updated_at: new Date().toISOString(),
      }),
    );

    const { error: prodError } = await supabase
      .from("productos")
      .upsert(productosRows, { onConflict: "tienda_id,nombre" });

    if (prodError)
      throw new Error(`Productos upsert failed: ${prodError.message}`);

    return NextResponse.json(
      {
        success: true,
        tienda_id: tienda.id,
        productos_insertados: productosRows.length,
        data: extracted,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[BarrioAI Upload Error]", error);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: "AI returned malformed structure", details: String(error) },
        { status: 502 },
      );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
