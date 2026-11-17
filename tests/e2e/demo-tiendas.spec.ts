import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Hackathon demo-data guard.
 *
 * docs/portal-writeup.md afirma que todas las tiendas visibles son
 * inventadas. Eso solo es cierto si en producción ninguna tienda real
 * aparece sin etiqueta (demo)/(E2E)/(seeded): «La Muralla» (menú real
 * subido el 2026-10-27, sin etiqueta) lo rompía y fue retirada.
 *
 * - Sin credenciales (CI): solo se verifica la coherencia documental.
 * - Con .env.local / env de Supabase: también se audita producción.
 */

function envLocal(): Record<string, string> {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function sinAcentos(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

test("writeup y guion listan las mismas tiendas demo, todas con (demo)", () => {
  const writeup = readFileSync(join(process.cwd(), "docs/portal-writeup.md"), "utf8");
  const guion = readFileSync(join(process.cwd(), "docs/demo-guion.md"), "utf8");

  const enGuion = [...guion.matchAll(/^\| (.+?) \(demo\) \|/gm)].map((m) => m[1]);
  expect(enGuion.length).toBeGreaterThan(0);
  for (const nombre of enGuion) {
    expect(sinAcentos(writeup), `writeup debe nombrar a ${nombre}`).toContain(
      sinAcentos(nombre),
    );
  }
  expect(sinAcentos(writeup)).not.toContain("la muralla");
  expect(sinAcentos(guion)).not.toContain("la muralla");
});

test("fixtures e2e: tiendas peruanas, sin taqueria mexicana", () => {
  const fixtures = readFileSync(
    join(process.cwd(), "tests/e2e/search-rows.ts"),
    "utf8",
  );
  const plano = sinAcentos(fixtures);
  expect(plano).not.toMatch(/taqueria|tacos|quesadilla|torta cubana/);
  expect(plano).toContain("pollo a la brasa");
});

test("produccion: solo tiendas demo peruanas, sin taqueria mexicana", async () => {
  const local = envLocal();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(!url || !key, "Sin Supabase configurado: solo aplica local/prod");

  const headers = { apikey: key!, Authorization: `Bearer ${key}` };
  const [resT, resP] = await Promise.all([
    fetch(`${url}/rest/v1/tiendas?select=nombre&order=nombre.asc`, { headers }),
    fetch(`${url}/rest/v1/productos?select=nombre`, { headers }),
  ]);
  expect(resT.ok).toBe(true);
  expect(resP.ok).toBe(true);
  const tiendas = (await resT.json()) as { nombre: string }[];
  const productos = (await resP.json()) as { nombre: string }[];
  const nombres = tiendas.map((t) => t.nombre.trim());

  expect(nombres).not.toContain("La Muralla");
  expect(nombres.filter((n) => !/\(demo\)$/i.test(n))).toEqual([]);
  const todo = sinAcentos(
    [...nombres, ...productos.map((p) => p.nombre)].join(" "),
  );
  expect(todo).not.toMatch(/taqueria|tacos|quesadilla|torta cubana|jamaica/);
  for (const esperada of [
    "polleria el ejemplo (demo)",
    "cevicheria la muestra (demo)",
    "bodega don ejemplo (demo)",
    "anticucheria el ejemplo (demo)",
    "chifa el ejemplo (demo)",
    "sangucheria la muestra (demo)",
  ]) {
    expect(sinAcentos(nombres.join(" | "))).toContain(esperada);
  }
});
