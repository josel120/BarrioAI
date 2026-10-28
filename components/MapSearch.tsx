"use client";

/**
 * Interactive search map for the buscar view.
 *
 * IMPORTANT: this module imports Leaflet at load time, which requires `window`.
 * It must only be loaded on the client — import it with
 * `next/dynamic(..., { ssr: false })` (see app/buscar/page.tsx).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoCoords, SearchResultRow } from "@/lib/search/types";
import { formatPrecio } from "@/lib/formatPrecio";
import { buildPedidoMessage, buildWhatsAppUrl } from "@/lib/formatWhatsApp";
import { ProductCard } from "@/components/ProductCard";

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
function createStoreIcon(precio: string | null, selected: boolean): L.DivIcon {
  const bag = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1.5 13.5a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1L6 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>`;
  const label = precio
    ? `<span class="text-[13px] font-extrabold" style="font-variant-numeric:tabular-nums">${precio}</span>`
    : "";
  const size = selected ? "transform:scale(1.12);" : "";
  const bg = selected ? "#14532d" : "#15803d";
  return L.divIcon({
    className: "barrio-pin",
    html: `<div class="flex items-center gap-1 rounded-full border-2 border-white px-2 py-1 text-white shadow-lg" style="background:${bg};width:max-content;${size}">${bag}${label}</div>`,
    iconSize: undefined,
    iconAnchor: [20, 14],
    popupAnchor: [0, -14],
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

export interface MapSearchProps {
  user: GeoCoords;
  results: SearchResultRow[];
  selectedId?: string | null;
  onSelectStore?: (tiendaId: string) => void;
  onCloseStore?: () => void;
}

function DragControl({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (active) map.dragging.enable(); else map.dragging.disable();
  }, [map, active]);
  return null;
}

function CenterOnSelected({ stores, selectedId }: { stores: StoreGroup[]; selectedId?: string | null }) {
  const map = useMap();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || prev.current === selectedId) return;
    prev.current = selectedId;
    const s = stores.find((x) => x.tienda_id === selectedId);
    if (s) map.setView([s.lat, s.lng], Math.max(map.getZoom(), 16));
  }, [map, stores, selectedId]);
  return null;
}

export function MapSearch({ user, results, selectedId, onSelectStore, onCloseStore }: MapSearchProps) {
  const [tileLocal, setTileLocal] = useState<string | null>(null);
  const tileId = selectedId !== undefined && selectedId !== null ? selectedId : tileLocal;
  const stores = useMemo(() => groupByStore(results), [results]);
  const tileStore = stores.find((s) => s.tienda_id === tileId) ?? null;
  const [mapActive, setMapActive] = useState(false);

  return (
    <div
      role="region"
      aria-label="Mapa de tiendas cercanas"
      className="relative z-0 h-72 w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
    >
      {!mapActive && (
        <button type="button" onClick={() => setMapActive(true)} className="absolute right-2 top-2 z-[500] inline-flex min-h-11 items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow dark:bg-zinc-900 dark:text-zinc-100">Activar mapa</button>
      )}
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
        <DragControl active={mapActive} />
        <CenterOnSelected stores={stores} selectedId={selectedId} />

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
            icon={createStoreIcon(
              store.top.precio != null ? formatPrecio(store.top.precio, store.top.moneda) : null,
              tileId === store.tienda_id,
            )}
            eventHandlers={{ click: () => { setTileLocal(store.tienda_id); onSelectStore?.(store.tienda_id); } }}
          />
        ))}
      </MapContainer>
      {tileStore && (
        <div key={tileStore.tienda_id} className="absolute inset-x-2 bottom-7 z-[1100]">
          <ProductCard
            nombre={tileStore.top.nombre}
            precio={tileStore.top.precio}
            moneda={tileStore.top.moneda}
            categoria={tileStore.top.categoria}
            descripcion={tileStore.top.descripcion}
            tiendaNombre={tileStore.tienda_nombre}
            distanciaM={tileStore.distance_m}
            extras={tileStore.extras}
            whatsappUrl={buildWhatsAppUrl(tileStore.tienda_telefono, buildPedidoMessage(tileStore.top.nombre, tileStore.tienda_nombre))}
            tiendaHref={`/tienda/${tileStore.tienda_id}`}
            onClose={() => { setTileLocal(null); onCloseStore?.(); }}
          />
        </div>
      )}
    </div>
  );
}
