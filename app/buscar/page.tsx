"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { formatPrecio } from "@/lib/formatPrecio";
import { formatDistance } from "@/lib/formatDistance";
import type { SearchResultRow } from "@/lib/search/types";
import { buildPedidoMessage, buildWhatsAppUrl } from "@/lib/formatWhatsApp";
import { MapSkeleton, ResultsSkeleton } from "@/components/SearchSkeletons";

// Leaflet requires `window`: load the map only on the client.
const MapSearch = dynamic(
  () => import("@/components/MapSearch").then((m) => m.MapSearch),
  { ssr: false, loading: () => <MapSkeleton /> },
);

type Status = "idle" | "loading" | "error";

function BuscarContenido() {
  const { coords, error: geoError } = useGeolocation();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [unavailable, setUnavailable] = useState(false);
  const [searched, setSearched] = useState(false);
  const autoRan = useRef(false);

  const doSearch = useCallback(async (query: string, lat: number, lng: number) => {
    setStatus("loading");
    setUnavailable(false);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, lat, lng }),
      });
      const data = (await res.json()) as {
        results?: SearchResultRow[];
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 503) setUnavailable(true);
        throw new Error(data.error ?? "Error en búsqueda");
      }
      setResults(data.results ?? []);
      setSource("semantic");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || q.trim().length < 2) return;
    void doSearch(q.trim(), coords.lat, coords.lng);
  }

  // Deep link from home (?q=…): run once coordinates are ready.
  useEffect(() => {
    if (!autoRan.current && coords && initialQ.trim().length >= 2) {
      autoRan.current = true;
      void doSearch(initialQ.trim(), coords.lat, coords.lng);
    }
  }, [coords, initialQ, doSearch]);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">
        Buscar en tu barrio
      </h1>

      <form onSubmit={onSearch} role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          ¿Qué buscas?
        </label>
        <input
          id="q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pollo a la brasa, ceviche, bodega…"
          minLength={2}
          maxLength={100}
          autoComplete="off"
          inputMode="search"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={status === "loading" || !coords}
          className="shrink-0 rounded-xl bg-mercado-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-mercado-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "…" : "Buscar"}
        </button>
      </form>

      {geoError && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {geoError}
        </p>
      )}

      {coords && <MapSearch user={coords} results={results} />}

      <p aria-live="polite" className="min-h-5 text-sm text-zinc-500">
        {status === "loading"
          ? "Buscando…"
          : searched && status === "idle" && results.length > 0
            ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"} cerca de ti`
            : ""}
      </p>

      {status === "loading" && <ResultsSkeleton />}

      {status === "error" && (
        <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200">
          {unavailable
            ? "La búsqueda no está disponible por ahora. Intenta más tarde."
            : "No pudimos buscar. Revisa tu conexión e intenta de nuevo."}
        </p>
      )}

      {searched && status === "idle" && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-base font-semibold">Sin resultados cerca de ti</p>
          <p className="max-w-60 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Prueba con otra palabra, como “ceviche”, “anticuchos” o “bodega”.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {results.map((r) => (
            <li key={r.producto_id} className="flex flex-col gap-1 py-3.5">
              <div className="flex items-baseline gap-2">
                <p className="min-w-0 flex-initial truncate font-semibold">
                  {r.nombre}
                </p>
                <span
                  aria-hidden="true"
                  className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700"
                />
                {r.precio != null && (
                  <p className="shrink-0 font-bold tabular-nums text-mercado-700 dark:text-mercado-500">
                    {formatPrecio(r.precio, r.moneda)}
                  </p>
                )}
              </div>
              <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">
                {r.tienda_nombre ?? "Tienda"}
                <span className="tabular-nums">
                  {" "}
                  · {formatDistance(r.distance_m)}
                </span>
                {r.categoria ? ` · ${r.categoria}` : ""}
              </p>
              {r.descripcion && (
                <p className="line-clamp-2 text-sm leading-6 break-words text-zinc-500 dark:text-zinc-400">
                  {r.descripcion}
                </p>
              )}
              {(() => {
                const wa = buildWhatsAppUrl(
                  r.tienda_telefono,
                  buildPedidoMessage(r.nombre, r.tienda_nombre),
                );
                return wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mercado-800"
                  >
                    Pedir por WhatsApp
                  </a>
                ) : null;
              })()}
            </li>
          ))}
        </ul>
      )}

      {source && results.length > 0 && (
        <p className="text-center text-xs text-zinc-400">
          {source === "semantic" ? "Búsqueda semántica" : "Búsqueda por texto"}
        </p>
      )}
    </main>
  );
}

export default function BuscarPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Buscar en tu barrio
          </h1>
          <p className="text-sm text-zinc-500">Cargando…</p>
        </main>
      }
    >
      <BuscarContenido />
    </Suspense>
  );
}
