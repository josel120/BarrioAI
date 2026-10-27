/**
 * Pure fixture data for E2E: rows shaped column-for-column like the
 * buscar_productos_y_tiendas RPC output (and the POST /api/search payload).
 * No Node-only imports — safe to bundle into a browser harness.
 */
export interface FixtureSearchRow {
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
  distance_m: number;
  similarity: number;
}

/** Two stores, three products; the second store has no phone number. */
export const SEARCH_ROWS: FixtureSearchRow[] = [
  {
    producto_id: "11111111-1111-1111-1111-111111111111",
    nombre: "Tacos al pastor",
    precio: 12.5,
    moneda: "PEN",
    categoria: "Comida",
    descripcion: "Con piña y cilantro",
    tienda_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tienda_nombre: "Taquería La Esquina",
    tienda_telefono: "+51 999 888 777",
    tienda_direccion: "Av. Principal 123",
    tienda_lat: -12.0885,
    tienda_lng: -77.086,
    distance_m: 148.2,
    similarity: 0.87,
  },
  {
    producto_id: "22222222-2222-2222-2222-222222222222",
    nombre: "Quesadilla de pollo",
    precio: 10.0,
    moneda: "PEN",
    categoria: "Comida",
    descripcion: null,
    tienda_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tienda_nombre: "Taquería La Esquina",
    tienda_telefono: "+51 999 888 777",
    tienda_direccion: "Av. Principal 123",
    tienda_lat: -12.0885,
    tienda_lng: -77.086,
    distance_m: 148.2,
    similarity: 0.71,
  },
  {
    producto_id: "33333333-3333-3333-3333-333333333333",
    nombre: "Inca Kola 500ml",
    precio: 3.5,
    moneda: "PEN",
    categoria: "Bebidas",
    descripcion: "Bien helada",
    tienda_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    tienda_nombre: "Bodega Don Pepe",
    tienda_telefono: null,
    tienda_direccion: null,
    tienda_lat: -12.0865,
    tienda_lng: -77.084,
    distance_m: 231.7,
    similarity: 0.62,
  },
];
