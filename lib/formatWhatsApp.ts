/**
 * Builds a wa.me deep link with a pre-filled order message.
 * Returns null when the store has no usable phone number.
 */
export function buildWhatsAppUrl(
  telefono: string | null | undefined,
  mensaje: string,
): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

/** Pre-filled order message (Spanish) for a product in a store. */
export function buildPedidoMessage(
  productoNombre: string,
  tiendaNombre: string,
): string {
  return (
    `Hola ${tiendaNombre}, vi "${productoNombre}" en BarrioAI ` +
    `y quiero pedirlo. ¿Sigue disponible?`
  );
}
