/** Precio formateado con Intl (es-PE): PEN se muestra como S/ con 2 decimales. */
export function formatPrecio(precio: number, moneda?: string | null): string {
  const code = moneda && /^[A-Za-z]{3}$/.test(moneda) ? moneda.toUpperCase() : "PEN";
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: code,
    }).format(precio);
  } catch {
    return `${code} ${precio.toFixed(2)}`;
  }
}
