"use client";
import { useEffect, useState } from "react";

type Stats = { tiendas: number; productos: number };
const CACHE_KEY = "barrioai-stats";

function leerCache(): Stats | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Stats) : null;
  } catch {
    return null;
  }
}

export function HomeStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let vivo = true;
    // Al volver a Inicio, lo guardado se muestra al instante, sin esperar red.
    const cached = leerCache();
    const mostrar = setTimeout(() => {
      if (vivo && cached) setStats(cached);
    }, 0);
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Stats | null) => {
        if (!vivo || !j) return;
        setStats(j);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(j));
        } catch {
          // Sin almacenamiento: solo dura esta visita.
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
      clearTimeout(mostrar);
    };
  }, []);

  if (!stats) {
    return (
      <div role="status" aria-label="Cargando tiendas y productos…" className="flex min-h-5 items-center">
        <span className="sr-only">Cargando tiendas y productos…</span>
        <span aria-hidden="true" className="h-4 w-56 max-w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }
  if (stats.tiendas === 0 && stats.productos === 0) return null;
  return (
    <p aria-live="polite" className="min-h-5 text-sm text-zinc-600 dark:text-zinc-300">
      Ya hay <strong className="tabular-nums">{stats.tiendas}</strong> {stats.tiendas === 1 ? "tienda" : "tiendas"} y{" "}
      <strong className="tabular-nums">{stats.productos}</strong> {stats.productos === 1 ? "producto" : "productos"} en BarrioAI.
    </p>
  );
}
