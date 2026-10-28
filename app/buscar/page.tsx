"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { formatPrecio } from "@/lib/formatPrecio";
import { formatDistance } from "@/lib/formatDistance";
import type { SearchResultRow } from "@/lib/search/types";
import { buildPedidoMessage, buildWhatsAppUrl } from "@/lib/formatWhatsApp";
import { MapSkeleton, ResultsSkeleton } from "@/components/SearchSkeletons";
import { LocationPicker } from "@/components/LocationPicker";
import { ChevronDownIcon, PinIcon } from "@/components/icons";

const MapSearch = dynamic(
  () => import("@/components/MapSearch").then((m) => m.MapSearch),
  { ssr: false, loading: () => <MapSkeleton /> },
);

type Status = "idle" | "loading" | "error";
type Sort = "relevancia" | "distancia" | "precio";
const RADIOS = [500, 1000, 2000, 5000] as const;

function BuscarContenido() {
  const { coords, error: geoError, locating, request, setManual } = useGeolocation();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [hint, setHint] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [unavailable, setUnavailable] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(5000);
  const [sort, setSort] = useState<Sort>("relevancia");
  const [categoria, setCategoria] = useState<string>("Todas");
  const autoRan = useRef(false);
  const [lastSearch, setLastSearch] = useState<{ q: string; lat: number; lng: number; radius: number } | null>(null);

  const doSearch = useCallback(async (query: string, lat: number, lng: number, radio: number) => {
    setLastSearch({ q: query, lat, lng, radius: radio });
    setExpandedId(null);
    setResults([]);
    setStatus("loading");
    setUnavailable(false);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, lat, lng, radius_m: radio }),
      });
      const data = (await res.json()) as { results?: SearchResultRow[]; error?: string };
      if (!res.ok) {
        if (res.status === 503) setUnavailable(true);
        throw new Error(data.error ?? "Error en búsqueda");
      }
      setResults(data.results ?? []);
      setSource("semantic");
      setStatus("idle");
    } catch {
      setResults([]);
      setStatus("error");
    }
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) {
      setHint("Escribe al menos 2 letras para buscar.");
      return;
    }
    setHint(null);
    if (!coords) {
      setHint("Primero usa tu ubicación o elige tu zona para buscar cerca de ti.");
      return;
    }
    void doSearch(q.trim(), coords.lat, coords.lng, radius);
  }

  useEffect(() => {
    if (!autoRan.current && coords && initialQ.trim().length >= 2) {
      autoRan.current = true;
      void doSearch(initialQ.trim(), coords.lat, coords.lng, 5000);
    }
  }, [coords, initialQ, doSearch]);

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(results.map((r) => r.categoria).filter(Boolean)))],
    [results],
  );
  const visibles = useMemo(() => {
    const filtrados = categoria === "Todas" ? results : results.filter((r) => r.categoria === categoria);
    const ordenados = [...filtrados];
    if (sort === "distancia") ordenados.sort((a, b) => a.distance_m - b.distance_m);
    if (sort === "precio") ordenados.sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity));
    return ordenados;
  }, [results, categoria, sort]);

  const statusText =
    status === "loading" ? "" : searched && status === "idle" && visibles.length > 0
      ? `${visibles.length} ${visibles.length === 1 ? "resultado" : "resultados"} cerca de ti`
      : "";

  function onSelectStore(tiendaId: string) {
    const primero = results.find((r) => r.tienda_id === tiendaId);
    if (!primero) return;
    setExpandedId(primero.producto_id);
    requestAnimationFrame(() => {
      document.getElementById(`row-${primero.producto_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Buscar en tu barrio</h1>

      <form onSubmit={onSearch} role="search" noValidate className="flex gap-2">
        <label htmlFor="q" className="sr-only">¿Qué buscas?</label>
        <input
          id="q" name="q" type="search" value={q}
          onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length >= 2) setHint(null); }}
          placeholder="Pollo a la brasa, ceviche, bodega…"
          minLength={2} maxLength={100} autoComplete="off" inputMode="search"
          aria-describedby={hint ? "q-hint" : undefined} aria-invalid={hint ? true : undefined}
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button type="submit" disabled={status === "loading"} className="min-h-11 shrink-0 rounded-xl bg-mercado-700 px-5 py-3 text-base font-semibold text-white transition-[background-color,transform] duration-[var(--duration-quick)] hover:bg-mercado-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
          Buscar
        </button>
      </form>
      {hint && <p id="q-hint" aria-live="polite" className="text-sm font-medium text-amber-700 dark:text-amber-300">{hint}</p>}

      {!coords && (
        <LocationPicker coords={coords} error={geoError} locating={locating} onRequest={request} onManual={setManual} />
      )}
      {coords && geoError && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{geoError}</p>}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Distancia máxima">
          {RADIOS.map((r) => (
            <button key={r} type="button" onClick={() => setRadius(r)} aria-pressed={radius === r} className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold ${radius === r ? "bg-mercado-700 text-white" : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"}`}>
              {r < 1000 ? `${r} m` : `${r / 1000} km`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="orden" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Ordenar</label>
          <select id="orden" name="orden" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900">
            <option value="relevancia">Más relevantes</option>
            <option value="distancia">Más cercanos</option>
            <option value="precio">Menor precio</option>
          </select>
        </div>
        {categorias.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categoría">
            {categorias.map((c) => (
              <button key={c} type="button" onClick={() => setCategoria(c)} aria-pressed={categoria === c} className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold ${categoria === c ? "bg-mercado-700 text-white" : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {coords && searched && <MapSearch user={coords} results={visibles} selectedId={expandedId ? (results.find((r) => r.producto_id === expandedId)?.tienda_id ?? null) : null} onSelectStore={onSelectStore} onCloseStore={() => setExpandedId(null)} />}

      <p aria-live="polite" className="min-h-5 text-sm text-zinc-600 dark:text-zinc-300">
        <span key={statusText} className="t-text-swap inline-block">{statusText}</span>
      </p>

      {status === "loading" && <ResultsSkeleton />}

      {status === "error" && (
        <div className="flex flex-col gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-950">
          <p className="text-sm leading-6 text-red-700 dark:text-red-200">
            {unavailable ? "La búsqueda no está disponible por ahora. Intenta más tarde." : "No pudimos buscar. Revisa tu conexión e intenta de nuevo."}
          </p>
          {lastSearch && (
            <button type="button" onClick={() => { if (lastSearch) void doSearch(lastSearch.q, lastSearch.lat, lastSearch.lng, lastSearch.radius); }} className="inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
          )}
        </div>
      )}

      {searched && status === "idle" && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-base font-semibold">Sin resultados cerca de ti</p>
          <p className="max-w-60 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Prueba con otra palabra, como “ceviche”, “anticuchos” o “bodega”, o amplía la distancia.</p>
        </div>
      )}
      {searched && status === "idle" && results.length > 0 && visibles.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-300">Ningún resultado en esta categoría. Elige “Todas”.</p>
      )}

      {visibles.length > 0 && (
        <ul key={`${visibles[0]?.producto_id}-${visibles.length}`} className="t-reveal flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {visibles.map((r) => {
            const wa = buildWhatsAppUrl(r.tienda_telefono, buildPedidoMessage(r.nombre, r.tienda_nombre));
            const expanded = expandedId === r.producto_id;
            const detailId = `detalle-${r.producto_id}`;
            const distancia = formatDistance(r.distance_m);
            return (
              <li key={r.producto_id} id={`row-${r.producto_id}`} className={expanded ? "bg-mercado-50 dark:bg-zinc-900" : undefined}>
                <div className="flex items-start gap-1">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : r.producto_id)} aria-expanded={expanded} aria-controls={detailId} aria-label={`${r.nombre} en ${r.tienda_nombre ?? "Tienda"}: ver detalle`} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-1 py-3.5 text-left">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-initial truncate font-semibold">{r.nombre}</span>
                        <span aria-hidden="true" className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700" />
                        <span className="shrink-0 font-bold tabular-nums text-mercado-700 dark:text-mercado-500">{r.precio != null ? formatPrecio(r.precio, r.moneda) : "Sin precio"}</span>
                      </span>
                      <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
                        {r.tienda_nombre ?? "Tienda"}{distancia ? <span className="tabular-nums">{" \u00b7 "}{distancia}</span> : null}{r.categoria ? ` \u00b7 ${r.categoria}` : ""}
                      </span>
                    </span>
                    <ChevronDownIcon className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Pedir ${r.nombre} por WhatsApp`} className="mt-2 inline-flex min-h-11 shrink-0 items-center rounded-full bg-mercado-700 px-3 py-2 text-sm font-semibold text-white">WhatsApp</a>
                  )}
                </div>
                <div id={detailId} inert={!expanded} className={`grid transition-[grid-template-rows] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] ${expanded ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-2 px-1 pb-4">
                      {r.descripcion && <p className="text-sm leading-6 break-words text-zinc-600 dark:text-zinc-300 [text-wrap:pretty]">{r.descripcion}</p>}
                      {r.tienda_direccion && (
                        <p className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300"><PinIcon className="h-4 w-4 shrink-0" /><span className="truncate">{r.tienda_direccion}</span></p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/tienda/${r.tienda_id}`} className="inline-flex min-h-11 items-center rounded-full border border-mercado-700 px-4 py-2 text-sm font-semibold text-mercado-800 dark:border-mercado-500 dark:text-mercado-300">Ver tienda</Link>
                        {!wa && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Esta tienda aún no registra WhatsApp.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {source && results.length > 0 && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{source === "semantic" ? "Búsqueda semántica" : "Búsqueda por texto"}</p>
      )}
    </div>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-4"><h1 className="text-2xl font-extrabold tracking-tight">Buscar en tu barrio</h1><ResultsSkeleton /></div>}>
      <BuscarContenido />
    </Suspense>
  );
}
