import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radio: z.coerce.number().min(500).max(10000).default(2000),
  limite: z.coerce.number().min(1).max(50).default(20),
});

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
        input: text,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data[0].embedding as number[];
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );

  const { q, lat, lng, radio, limite } = parsed.data;
  const embedding = await embedQuery(q);

  // Primary: Hybrid Geo + Vector Search
  if (embedding) {
    const { data, error } = await supabaseAdmin.rpc(
      "buscar_productos_cercanos",
      {
        query_embedding: `[${embedding.join(",")}]`,
        lat,
        lng,
        radio_metros: radio,
        limite,
      },
    );
    if (!error && data) {
      return NextResponse.json(
        { source: "semantic", results: data },
        {
          headers: {
            "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
          },
        },
      );
    }
  }

  // Fallback: Full-text (spanish) + distance
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select(
      "id, nombre, precio, categoria, descripcion, tiendas!inner(nombre, ubicacion)",
    )
    .textSearch("fts", q, { type: "websearch", config: "spanish" })
    .eq("disponible", true)
    .limit(limite);

  if (error)
    return NextResponse.json({ error: "Error en búsqueda" }, { status: 500 });
  return NextResponse.json({ source: "fts", results: data });
}
