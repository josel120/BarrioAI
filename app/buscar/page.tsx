"use client";

import { useState } from "react";
import { useGeolocation } from "@/lib/hooks/useGeolocation";

interface SearchResult {
  id: string;
  nombre: string;
  precio: number | null;
  moneda?: string;
  categoria?: string;
  descripcion?: string | null;
  tienda_nombre?: string;
  tienda_telefono?: string | null;
  distancia_metros?: number;
  similitud?: number;
  tiendas?: { nombre: string };
}

// Row shape returned by POST /api/search (match_productos RPC).
interface ApiSearchRow {
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

type Status = "idle" | "loading" | "error";

function formatDistance(m?: number): string {
  if (m == null) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function BuscarPage() {
  const { coords, error: geoError } = useGeolocation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [searched, setSearched] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || q.trim().length < 2) return;
    setStatus("loading");
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: q.trim(),
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      const data = (await res.json()) as {
        results?: ApiSearchRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Error en búsqueda");
      setResults(
        (data.results ?? []).map((r) => ({
          id: r.producto_id,
          nombre: r.nombre,
          precio: r.precio,
          moneda: r.moneda,
          categoria: r.categoria,
          descripcion: r.descripcion,
          tienda_nombre: r.tienda_nombre,
          distancia_metros: r.distance_m,
          similitud: r.similarity,
        })),
      );
      setSource("semantic");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto p-4 pb-24 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Buscar en tu barrio
      </h1>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tacos, pan, corte de pelo…"
          minLength={2}
          maxLength={100}
          className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={status === "loading" || !coords}
          className="bg-green-600 active:bg-green-700 text-white font-semibold px-5 rounded-lg disabled:opacity-60"
        >
          {status === "loading" ? "…" : "Buscar"}
        </button>
      </form>

      {geoError && (
        <p className="text-amber-700 bg-amber-50 p-3 rounded-lg text-sm">
          {geoError}
        </p>
      )}

      {status === "error" && (
        <p className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">
          No pudimos buscar. Intenta de nuevo.
        </p>
      )}

      {searched && status === "idle" && results.length === 0 && (
        <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">
          Sin resultados cerca de ti. Prueba con otra palabra.
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((r) => (
            <li
              key={r.id}
              className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white dark:bg-zinc-900"
            >
              <div className="flex justify-between items-baseline gap-2">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {r.nombre}
                </p>
                {r.precio != null && (
                  <p className="font-bold text-green-700 whitespace-nowrap">
                    ${r.precio}
                    {r.moneda ? ` ${r.moneda}` : ""}
                  </p>
                )}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {r.tienda_nombre ?? r.tiendas?.nombre ?? "Tienda"}
                {r.distancia_metros != null &&
                  ` · ${formatDistance(r.distancia_metros)}`}
                {r.categoria ? ` · ${r.categoria}` : ""}
              </p>
              {r.descripcion && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {r.descripcion}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {source && results.length > 0 && (
        <p className="text-xs text-zinc-400 text-center">
          {source === "semantic" ? "Búsqueda semántica" : "Búsqueda por texto"}
        </p>
      )}
    </main>
  );
}
