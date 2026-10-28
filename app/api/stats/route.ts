import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const [tiendas, productos] = await Promise.all([
      supabase.from("tiendas").select("id", { count: "exact", head: true }),
      supabase.from("productos").select("id", { count: "exact", head: true }),
    ]);
    if (tiendas.error || productos.error)
      return NextResponse.json({ error: "Sin datos" }, { status: 500 });
    return NextResponse.json(
      { tiendas: tiendas.count ?? 0, productos: productos.count ?? 0 },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ error: "Sin datos" }, { status: 500 });
  }
}
