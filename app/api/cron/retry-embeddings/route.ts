import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedTexts } from "@/lib/ai/embeddings";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

// Lazy: module import must stay side-effect free for `next build`.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface PendingRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  embedding_attempts: number;
}

/**
 * Re-embeds productos left unsearchable by a provider failure at upload
 * time (embedding_status pending/failed). Invoked by Vercel Cron
 * (see vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 * A pg_cron + pg_net schedule can call the same endpoint.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Reintento no configurado" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, categoria, embedding_attempts")
    .in("embedding_status", ["pending", "failed"])
    .lt("embedding_attempts", MAX_ATTEMPTS)
    .order("updated_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[BarrioAI Retry Error]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as PendingRow[];
  if (rows.length === 0) {
    return NextResponse.json({ procesados: 0, listos: 0, fallidos: 0 });
  }

  const texts = rows.map(
    (r) => `${r.nombre}. ${r.descripcion ?? ""} [${r.categoria}]`,
  );
  const vectors = await embedTexts(texts);

  let listos = 0;
  let fallidos = 0;
  await Promise.all(
    rows.map(async (row, i) => {
      const vector = vectors[i];
      const attempts = row.embedding_attempts + 1;
      const { error: upError } = await supabase
        .from("productos")
        .update({
          embedding: vector ? `[${vector.join(",")}]` : null,
          embedding_status: vector
            ? "ready"
            : attempts >= MAX_ATTEMPTS
              ? "failed"
              : "pending",
          embedding_attempts: attempts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upError) fallidos += 1;
      else if (vector) listos += 1;
      else fallidos += 1;
    }),
  );

  return NextResponse.json({
    procesados: rows.length,
    listos,
    fallidos,
  });
}
