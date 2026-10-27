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
import { TimedLoading } from "@/components/Loading";
import { ChevronDownIcon, PinIcon } from "@/components/icons";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const autoRan = useRef(false);

  const doSearch = useCallback(async (query: string, lat: number, lng: number) => {
    setExpandedId(null);
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

  const statusText =
    status === "loading"
      ? ""
      : searched && status === "idle" && results.length > 0
        ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"} cerca de ti`
        : "";

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
          className="min-h-11 shrink-0 rounded-xl bg-mercado-700 px-5 py-3 text-base font-semibold text-white transition-[background-color,transform] duration-[var(--duration-quick)] hover:bg-mercado-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Buscar
        </button>
      </form>

      {geoError && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {geoError}
        </p>
      )}

      {coords && <MapSearch user={coords} results={results} />}

      <p aria-live="polite" className="min-h-5 text-sm text-zinc-500">
        <span key={statusText} className="t-text-swap inline-block">
          {statusText}
        </span>
      </p>

      <TimedLoading active={status === "loading"} label="Buscando" expectedMs={8000}><ResultsSkeleton /></TimedLoading>

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
        <ul
          key={`${results[0]?.producto_id}-${results.length}`}
          className="t-reveal flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {results.map((r) => {
            const wa = buildWhatsAppUrl(
              r.tienda_telefono,
              buildPedidoMessage(r.nombre, r.tienda_nombre),
            );
            const expanded = expandedId === r.producto_id;
            const detailId = `detalle-${r.producto_id}`;
            return (
              <li
                key={r.producto_id}
                className={
                  expanded
                    ? "bg-mercado-50 dark:bg-zinc-900"
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expanded ? null : r.producto_id)
                  }
                  aria-expanded={expanded}
                  aria-controls={detailId}
                  aria-label={`${r.nombre} en ${r.tienda_nombre ?? "Tienda"}: ver detalle`}
                  className="flex min-h-11 w-full items-center gap-2 px-1 py-3.5 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-initial truncate font-semibold">
                        {r.nombre}
                      </span>
                      <span
                        aria-hidden="true"
                        className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700"
                      />
                      {r.precio != null && (
                        <span className="shrink-0 font-bold tabular-nums text-mercado-700 dark:text-mercado-500">
                          {formatPrecio(r.precio, r.moneda)}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
                      {r.tienda_nombre ?? "Tienda"}
                      <span className="tabular-nums">
                        {" "}
                        · {formatDistance(r.distance_m)}
                      </span>
                      {r.categoria ? ` · ${r.categoria}` : ""}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  id={detailId}
                  className={`grid transition-[grid-template-rows] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] ${expanded ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-2 px-1 pb-4">
                      {r.descripcion && (
                        <p className="text-sm leading-6 break-words text-zinc-600 dark:text-zinc-300 [text-wrap:pretty]">
                          {r.descripcion}
                        </p>
                      )}
                      {r.tienda_direccion && (
                        <p className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                          <PinIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {r.tienda_direccion}
                          </span>
                        </p>
                      )}
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-[var(--duration-quick)] hover:bg-mercado-800 active:scale-[0.98]"
                        >
                          Pedir por WhatsApp
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-zinc-500">
                          Esta tienda aún no registra WhatsApp.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
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
          <TimedLoading active label="Cargando búsqueda" expectedMs={8000} />
        </main>
      }
    >
      <BuscarContenido />
    </Suspense>
  );
}
