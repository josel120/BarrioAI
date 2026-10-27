import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { embedQuery, isEmbeddingAvailable } from "@/lib/ai/embeddings";
import type { SearchResultRow } from "@/lib/search/types";

export const runtime = "nodejs";

const SearchBodySchema = z.object({
  q: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(100).max(50000).default(5000),
  threshold: z.number().min(0).max(1).default(0.3),
  limit: z.number().int().min(1).max(50).default(20),
});

type SearchBody = z.infer<typeof SearchBodySchema>;

// Lazy: module import must stay side-effect free for `next build`.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
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
  const { q, lat, lng, radius_m, threshold, limit }: SearchBody = parsed.data;

  // No embedding provider configured (neither Meta nor OpenAI).
  if (!isEmbeddingAvailable()) {
    return NextResponse.json(
      { error: "busqueda semantica no disponible" },
      { status: 503 },
    );
  }

  // Meta Llama embeddings when META_* is configured, else OpenAI — always the
  // same provider+model the ingestion pipeline used (see lib/ai/embeddings.ts).
  const embedding = await embedQuery(q);
  if (!embedding) {
    return NextResponse.json(
      { error: "busqueda semantica no disponible" },
      { status: 503 },
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("buscar_productos_y_tiendas", {
    query_embedding: embedding,
    user_lat: lat,
    user_lng: lng,
    similarity_threshold: threshold,
    max_distance_m: radius_m,
    match_count: limit,
  });

  if (error) {
    console.error("[BarrioAI Search Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // PostgREST may serialize numeric/doble columns loosely; normalize the
  // unified payload so the client always gets a typed SearchResultRow[].
  const rows = (data ?? []) as SearchResultRow[];
  const results: SearchResultRow[] = rows.map((r) => ({
    producto_id: r.producto_id,
    nombre: r.nombre,
    precio: r.precio == null ? null : Number(r.precio),
    moneda: r.moneda,
    categoria: r.categoria,
    descripcion: r.descripcion,
    tienda_id: r.tienda_id,
    tienda_nombre: r.tienda_nombre,
    tienda_telefono: r.tienda_telefono,
    tienda_direccion: r.tienda_direccion,
    tienda_lat: Number(r.tienda_lat),
    tienda_lng: Number(r.tienda_lng),
    distance_m: Number(r.distance_m),
    similarity: Number(r.similarity),
  }));

  return NextResponse.json(
    { results, count: results.length },
    { status: 200 },
  );
}
