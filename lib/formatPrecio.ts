/** Precio con símbolo de moneda. PEN se muestra como soles (S/). */
export function formatPrecio(precio: number, moneda?: string | null): string {
  if (moneda === "PEN") return `S/ ${precio}`;
  if (moneda) return `$${precio} ${moneda}`;
  return `$${precio}`;
}
