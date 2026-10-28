"use client";
import { LUGARES } from "@/lib/lugares";
import type { GeoCoords } from "@/lib/search/types";

/** GPS con gesto del usuario + zona manual. Nunca bloquea el flujo. */
export function LocationPicker({
  coords,
  error,
  locating,
  onRequest,
  onManual,
  idPrefix = "zona",
}: {
  coords: GeoCoords | null;
  error: string | null;
  locating: boolean;
  onRequest: () => void;
  onManual: (c: GeoCoords) => void;
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRequest}
          disabled={locating}
          className="inline-flex min-h-11 items-center rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mercado-800 disabled:opacity-60"
        >
          {locating ? "Localizando…" : coords ? "Actualizar mi ubicación" : "Usar mi ubicación"}
        </button>
        <span aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          {coords
            ? `Ubicación lista (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
            : "Usamos tu ubicación solo para mostrarte tiendas cercanas."}
        </span>
      </div>
      {error && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {error} También puedes elegir tu zona:
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-select`} className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Tu zona (si no usas GPS)
        </label>
        <select
          id={`${idPrefix}-select`}
          name="zona"
          defaultValue=""
          onChange={(e) => {
            const lugar = LUGARES.find((l) => l.nombre === e.target.value);
            if (lugar) onManual({ lat: lugar.lat, lng: lugar.lng });
          }}
          className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Elige tu zona…</option>
          {LUGARES.map((l) => (
            <option key={l.nombre} value={l.nombre}>{l.nombre}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
