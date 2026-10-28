import { formatPrecio } from "@/lib/formatPrecio";
import { formatDistance } from "@/lib/formatDistance";
import { CloseIcon } from "@/components/icons";

export interface ProductCardProps {
  /** Producto destacado de la tienda (el mejor match de la búsqueda). */
  nombre: string;
  precio: number | null;
  moneda: string;
  categoria?: string | null;
  descripcion?: string | null;
  tiendaNombre: string;
  /** Distancia desde el usuario, en metros. */
  distanciaM?: number | null;
  /** Otros productos de la misma tienda que también coinciden. */
  extras?: number;
  /** URL wa.me lista para pedir, o null si la tienda no registra WhatsApp. */
  whatsappUrl: string | null;
  /** Ruta a la página de la tienda con todo su menú. */
  tiendaHref: string;
  /** Cierra el tile; si no se pasa, no se muestra el botón de cerrar. */
  onClose?: () => void;
}

/**
 * Tile propio de producto sobre el mapa (reemplaza al popup de Leaflet).
 *
 * Lectura en una pasada, como un ticket de bodega que se revisa de pie:
 * tienda, distancia, producto con su precio a la derecha y el pedido.
 * El precio es el único elemento que grita — 26px extrabold tabular en
 * verde de la casa —; todo lo demás se queda quieto. La entrada es el
 * panel-reveal del sistema (sube 8px con desenfoque de 2px, 250ms) y se
 * apaga sola con `prefers-reduced-motion` desde globals.css.
 */
export function ProductCard({
  nombre,
  precio,
  moneda,
  categoria,
  descripcion,
  tiendaNombre,
  distanciaM,
  extras = 0,
  whatsappUrl,
  tiendaHref,
  onClose,
}: ProductCardProps) {
  const distancia = distanciaM != null ? formatDistance(distanciaM) : "";

  return (
    <article
      data-tile
      aria-label={`Detalle de ${tiendaNombre}`}
      className="t-tile-in rounded-[20px] bg-white p-5 shadow-[0_16px_40px_rgb(0_0_0/0.18),0_2px_8px_rgb(0_0_0/0.08)] dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[17px] font-extrabold leading-snug tracking-tight text-balance text-zinc-900 dark:text-zinc-50">
          {tiendaNombre}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Cerrar detalle de ${tiendaNombre}`}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors duration-[var(--duration-quick)] hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {(distancia || extras > 0) && (
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {distancia && <span className="tabular-nums">a {distancia} de ti</span>}
          {extras > 0 && (
            <span className="tabular-nums">
              {distancia ? " · " : ""}+{extras}{" "}
              {extras === 1 ? "producto" : "productos"} más
            </span>
          )}
        </p>
      )}

      <div className="mt-3.5 border-t border-dashed border-zinc-200 pt-3.5 dark:border-zinc-700">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-initial truncate text-[15px] font-semibold leading-6 text-zinc-900 dark:text-zinc-50">
            {nombre}
          </p>
          <span
            aria-hidden="true"
            className="mx-1 min-w-4 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-600"
          />
          {precio != null ? (
            <span className="shrink-0 text-[26px] font-extrabold leading-none tabular-nums text-mercado-700 dark:text-mercado-500">
              {formatPrecio(precio, moneda)}
            </span>
          ) : (
            <span className="shrink-0 text-sm font-semibold leading-none text-zinc-500 dark:text-zinc-400">
              Sin precio
            </span>
          )}
        </div>
        {(categoria || descripcion) && (
          <p className="mt-1 truncate text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">
            {[categoria, descripcion].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="barrio-wa inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-mercado-700 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-mercado-800 active:scale-[0.98]"
          >
            Pedir por WhatsApp
          </a>
        ) : (
          <p className="min-w-0 flex-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Esta tienda aún no registra WhatsApp.
          </p>
        )}
        <a
          href={tiendaHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-mercado-700 px-4 py-2.5 text-sm font-semibold text-mercado-800 transition-colors duration-[var(--duration-quick)] hover:bg-mercado-50 dark:border-mercado-500 dark:text-mercado-300 dark:hover:bg-mercado-950"
        >
          Ver tienda
        </a>
      </div>
    </article>
  );
}
