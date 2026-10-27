/**
 * Loading skeletons for the buscar view (map + ticket rows).
 * Deliberately free of Leaflet imports so it can render on the server
 * as the `loading` fallback of the dynamically imported MapSearch.
 *
 * Rows mimic real ticket rows (name + dotted leader + price) with
 * varied widths, so the skeleton reads as this screen, not a generic
 * stack of gray pills. Pulse is staggered per row, never uniform.
 */
const NAME_WIDTHS = ["w-32", "w-40", "w-28"];
const META_WIDTHS = ["w-48", "w-36", "w-44"];

export function MapSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando mapa…"
      className="t-reveal h-72 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800"
    >
      <span className="sr-only">Cargando mapa…</span>
    </div>
  );
}

export function ResultsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando resultados…"
      className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
    >
      <span className="sr-only">Cargando resultados…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex animate-pulse flex-col gap-2 py-3.5"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="flex items-baseline gap-2">
            <div
              className={`h-5 ${NAME_WIDTHS[i % NAME_WIDTHS.length]} rounded-full bg-zinc-200 dark:bg-zinc-800`}
            />
            <span className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700" />
            <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div
            className={`h-4 ${META_WIDTHS[i % META_WIDTHS.length]} rounded-full bg-zinc-200 dark:bg-zinc-800`}
          />
        </div>
      ))}
    </div>
  );
}
