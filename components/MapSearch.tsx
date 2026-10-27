"use client";

/**
 * Interactive search map for the buscar view.
 *
 * IMPORTANT: this module imports Leaflet at load time, which requires `window`.
 * It must only be loaded on the client — import it with
 * `next/dynamic(..., { ssr: false })` (see app/buscar/page.tsx).
 */

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoCoords, SearchResultRow } from "@/lib/search/types";
import { formatDistance } from "@/lib/formatDistance";
import { formatPrecio } from "@/lib/formatPrecio";
import { buildPedidoMessage, buildWhatsAppUrl } from "@/lib/formatWhatsApp";

/** One marker per store, collapsed from its matching products. */
interface StoreGroup {
  tienda_id: string;
  tienda_nombre: string;
  tienda_telefono: string | null;
  tienda_direccion: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  /** Best match (results arrive ranked by similarity, then distance). */
  top: SearchResultRow;
  extras: number;
}

function groupByStore(results: SearchResultRow[]): StoreGroup[] {
  const byId = new Map<string, StoreGroup>();
  for (const r of results) {
    const existing = byId.get(r.tienda_id);
    if (!existing) {
      byId.set(r.tienda_id, {
        tienda_id: r.tienda_id,
        tienda_nombre: r.tienda_nombre,
        tienda_telefono: r.tienda_telefono,
        tienda_direccion: r.tienda_direccion,
        lat: r.tienda_lat,
        lng: r.tienda_lng,
        distance_m: r.distance_m,
        top: r,
        extras: 0,
      });
    } else {
      existing.extras += 1;
      existing.distance_m = Math.min(existing.distance_m, r.distance_m);
    }
  }
  return [...byId.values()];
}

/**
 * Store pin as a divIcon (inline SVG, no image assets).
 *
 * This sidesteps the classic Next.js + Leaflet bug where the default marker
 * PNGs 404 because the bundler never resolves Leaflet's relative image URLs:
 * there are no image URLs at all. `currentColor` + mercado utilities keep the
 * pin on the design-system palette (and the Meta theme override).
 */
function createStoreIcon(): L.DivIcon {
  return L.divIcon({
    className: "barrio-pin",
    html: `<div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-mercado-700 text-white shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1.5 13.5a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1L6 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

/**
 * Recenters the map whenever the user location or the store set changes.
 * (MapContainer's `center` prop only applies on first mount, so an explicit
 * controller is required.)
 */
function RecenterOnResults({
  user,
  stores,
}: {
  user: GeoCoords;
  stores: StoreGroup[];
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (stores.length === 0) {
      map.setView([user.lat, user.lng], 15);
      return;
    }
    const bounds = L.latLngBounds([
      [user.lat, user.lng],
      ...stores.map(
        (s) => [s.lat, s.lng] as [number, number],
      ),
    ]);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
  }, [map, user.lat, user.lng, stores]);

  return null;
}

function StorePopup({ store }: { store: StoreGroup }) {
  const whatsappUrl = buildWhatsAppUrl(
    store.tienda_telefono,
    buildPedidoMessage(store.top.nombre, store.tienda_nombre),
  );

  return (
    <Popup minWidth={200} maxWidth={260}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-zinc-900">
          {store.tienda_nombre}
        </p>
        <p className="text-xs leading-5 text-zinc-600">
          {store.top.nombre}
          {store.top.precio != null && (
            <>
              {" · "}
              <span className="font-bold tabular-nums">
                {formatPrecio(store.top.precio, store.top.moneda)}
              </span>
            </>
          )}
        </p>
        {store.tienda_direccion && (
          <p className="text-xs leading-5 text-zinc-600">
            {store.tienda_direccion}
          </p>
        )}
        <p className="text-xs tabular-nums text-zinc-500">
          {formatDistance(store.distance_m)}
          {store.extras > 0 &&
            ` · +${store.extras} ${store.extras === 1 ? "producto" : "productos"}`}
        </p>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="barrio-wa mt-1.5 inline-flex min-h-11 items-center justify-center rounded-full bg-mercado-700 px-4 py-2 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-[var(--duration-quick)] hover:bg-mercado-800 active:scale-[0.98]"
          >
            Pedir por WhatsApp
          </a>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">
            Esta tienda aún no registra WhatsApp.
          </p>
        )}
      </div>
    </Popup>
  );
}

export interface MapSearchProps {
  user: GeoCoords;
  results: SearchResultRow[];
}

export function MapSearch({ user, results }: MapSearchProps) {
  const stores = useMemo(() => groupByStore(results), [results]);
  const storeIcon = useMemo(() => createStoreIcon(), []);

  return (
    <div
      aria-label="Mapa de tiendas cercanas"
      className="relative z-0 h-72 w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
    >
      <MapContainer
        center={[user.lat, user.lng]}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOnResults user={user} stores={stores} />

        {/* User location: halo + blue dot, distinct from store pins. */}
        <CircleMarker
          center={[user.lat, user.lng]}
          radius={22}
          pathOptions={{
            color: "var(--color-mercado-700)",
            weight: 0,
            fillColor: "var(--color-mercado-700)",
            fillOpacity: 0.15,
          }}
          interactive={false}
        />
        <CircleMarker
          center={[user.lat, user.lng]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "var(--color-mercado-700)",
            fillOpacity: 1,
          }}
        />

        {stores.map((store) => (
          <Marker
            key={store.tienda_id}
            position={[store.lat, store.lng]}
            icon={storeIcon}
          >
            <StorePopup store={store} />
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
