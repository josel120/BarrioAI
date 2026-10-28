import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rate = checkRateLimit(`tienda:${clientIp(req)}`, LIMITS.tiendaRatePerMinute, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  try {
    const supabase = getSupabase();
    const { data: tienda, error } = await supabase
      .from("tiendas")
      .select("id, nombre, telefono, direccion, foto_menu_url")
      .eq("id", id)
      .single();
    if (error || !tienda)
      return NextResponse.json(
        { error: "No encontramos esta tienda. Puede que ya no esté disponible." },
        { status: 404 },
      );
    const { data: productos } = await supabase
      .from("productos")
      .select("id, nombre, precio, moneda, categoria, descripcion")
      .eq("tienda_id", id)
      .eq("disponible", true)
      .order("nombre")
      .limit(LIMITS.tiendaMaxProducts);
    return NextResponse.json(
      { tienda, productos: productos ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No pudimos cargar la tienda. Intenta de nuevo." },
      { status: 500 },
    );
  }
}
