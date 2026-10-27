/**
 * Unified search result row: one matching product joined with its store.
 * Produced by POST /api/search (buscar_productos_y_tiendas RPC) and consumed
 * by the buscar page and the MapSearch component.
 */
export interface SearchResultRow {
  producto_id: string;
  nombre: string;
  precio: number | null;
  moneda: string;
  categoria: string;
  descripcion: string | null;
  tienda_id: string;
  tienda_nombre: string;
  tienda_telefono: string | null;
  tienda_direccion: string | null;
  tienda_lat: number;
  tienda_lng: number;
  /** Distance from the user in meters (PostGIS geography). */
  distance_m: number;
  /** Cosine similarity between query and product embedding. */
  similarity: number;
}

export interface GeoCoords {
  lat: number;
  lng: number;
}
