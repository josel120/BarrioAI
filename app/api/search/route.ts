import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";

const SearchBodySchema = z.object({
  q: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(100).max(50000).default(5000),
  limit: z.number().int().min(1).max(50).default(20),
});

type SearchBody = z.infer<typeof SearchBodySchema>;

interface SearchResultRow {
  producto_id: string;
  tienda_id: string;
  tienda_nombre: string;
  nombre: string;
  precio: number | null;
  moneda: string;
  categoria: string;
  descripcion: string | null;
  distance_m: number;
  similarity: number;
}

interface EmbeddingsResponse {
  data: { index: number; embedding: number[] }[];
}

// Lazy: module import must stay side-effect free for `next build`.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function embedQuery(q: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
        input: q,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EmbeddingsResponse;
    const embedding = json.data
      .slice()
      .sort((a, b) => a.index - b.index)[0]?.embedding;
    return embedding ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = SearchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { q, lat, lng, radius_m, limit }: SearchBody = parsed.data;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "busqueda semantica no disponible" },
      { status: 503 },
    );
  }

  const embedding = await embedQuery(q);
  if (!embedding) {
    return NextResponse.json(
      { error: "busqueda semantica no disponible" },
      { status: 503 },
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("match_productos", {
    query_embedding: embedding,
    match_lat: lat,
    match_lng: lng,
    radius_m,
    match_count: limit,
  });

  if (error) {
    console.error("[BarrioAI Search Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as SearchResultRow[];
  const results: SearchResultRow[] = rows.map((r) => ({
    producto_id: r.producto_id,
    tienda_id: r.tienda_id,
    tienda_nombre: r.tienda_nombre,
    nombre: r.nombre,
    precio: r.precio,
    moneda: r.moneda,
    categoria: r.categoria,
    descripcion: r.descripcion,
    distance_m: r.distance_m,
    similarity: r.similarity,
  }));

  return NextResponse.json(
    { results, count: results.length },
    { status: 200 },
  );
}
