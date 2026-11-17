/**
 * Deduplicación de menús republicados.
 *
 * Una misma tienda puede llegar varias veces: el mismo archivo de foto,
 * una foto nueva del mismo pizarrón, o la misma lista revisada con
 * diferencias de mayúsculas/espacios/acentos. Sin normalizar, cada
 * republicación creaba una tienda nueva y volvía a insertar sus productos.
 *
 * Este módulo es puro (sin red ni BD) para poder usarlo igual en el
 * servidor (`app/api/upload`) y en los formularios del cliente.
 */

export interface ProductoComparable {
  name: string;
  price?: number | null;
}

export interface CandidataDuplicada {
  id: string;
  nombre: string;
  foto_hash?: string | null;
  distancia_m?: number | null;
  productos: { nombre: string; precio?: number | null }[];
}

export type MotivoDuplicado = "foto-identica" | "nombre-y-zona" | "menu-coincide";

export interface DuplicadoDetectado {
  candidata: CandidataDuplicada;
  motivo: MotivoDuplicado;
  coincidencias: number;
}

/** Radio (m) en el que dos publicaciones se consideran "el mismo lugar". */
export const RADIO_DUPLICADO_M = 100;

/** Nombres que no identifican a una tienda: nunca bastan para deduplicar. */
const NOMBRES_GENERICOS = new Set(["", "mi tienda", "tienda", "sin nombre"]);

/** "  Pollería   El Sol " -> "polleria el sol" (minúsculas, sin acentos). */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    // Quita marcas diacríticas (U+0300–U+036F) tras descomponer.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizarNombreProducto(nombre: string): string {
  return normalizarTexto(nombre);
}

export function esNombreTiendaGenerico(nombre: string | null | undefined): boolean {
  return NOMBRES_GENERICOS.has(normalizarTexto(nombre ?? ""));
}

/**
 * Quita productos repetidos dentro de una misma lista (p. ej. la IA leyó
 * dos veces la misma línea, o el comerciante agregó un duplicado al
 * revisar). Conserva la primera aparición y rescata el precio de un
 * duplicado posterior si la primera no tenía.
 */
export function dedupeProductos<T extends ProductoComparable>(items: T[]): T[] {
  const vistos = new Map<string, T>();
  for (const item of items) {
    const clave = normalizarNombreProducto(item.name);
    if (clave === "") continue;
    const previo = vistos.get(clave);
    if (!previo) {
      vistos.set(clave, item);
    } else if (
      (previo.price === null || previo.price === undefined) &&
      item.price !== null &&
      item.price !== undefined
    ) {
      vistos.set(clave, { ...previo, price: item.price });
    }
  }
  return [...vistos.values()];
}

/**
 * Productos que coinciden entre el menú nuevo y el de una tienda
 * candidata. Si ambos tienen precio, deben coincidir: dos pizarrones
 * distintos pueden compartir "arroz con pollo", pero es raro que
 * compartan nombre y precio en casi todo el menú.
 */
export function contarCoincidencias(
  nuevos: ProductoComparable[],
  existentes: { nombre: string; precio?: number | null }[],
): number {
  const previos = new Map<string, number | null>();
  for (const p of existentes) {
    previos.set(normalizarNombreProducto(p.nombre), p.precio ?? null);
  }
  let coincidencias = 0;
  for (const item of dedupeProductos(nuevos)) {
    const clave = normalizarNombreProducto(item.name);
    if (!previos.has(clave)) continue;
    const precioPrevio = previos.get(clave) ?? null;
    const precioNuevo = item.price ?? null;
    if (precioPrevio === null || precioNuevo === null || precioPrevio === precioNuevo) {
      coincidencias++;
    }
  }
  return coincidencias;
}

/**
 * Decide si una candidata cercana es la misma tienda que se intenta
 * publicar. Conservador a propósito: un falso positivo solo bloquea con
 * 409 (no borra nada), pero un falso negativo vuelve a duplicar.
 *
 * - foto-identica: el hash SHA-256 de la foto ya está publicado.
 * - nombre-y-zona: mismo nombre (no genérico) a <= RADIO_DUPLICADO_M.
 *   Cubre republicar el mismo negocio aunque el menú haya cambiado.
 * - menu-coincide: sin nombre útil (p. ej. flujo /vender, que publica
 *   como "Mi Tienda"), pero >= 80% del menú más corto coincide en
 *   nombre+precio y hay al menos 3 coincidencias. Cubre tomar una foto
 *   nueva del mismo pizarrón.
 */
export function evaluarDuplicado(
  candidata: CandidataDuplicada,
  nuevos: ProductoComparable[],
  nombreNuevo: string | null | undefined,
  fotoHash: string,
): DuplicadoDetectado | null {
  if (candidata.foto_hash && candidata.foto_hash === fotoHash) {
    return { candidata, motivo: "foto-identica", coincidencias: 0 };
  }

  const cerca =
    candidata.distancia_m !== null &&
    candidata.distancia_m !== undefined &&
    candidata.distancia_m <= RADIO_DUPLICADO_M;
  if (!cerca) return null;

  const coincidencias = contarCoincidencias(nuevos, candidata.productos);

  if (
    !esNombreTiendaGenerico(nombreNuevo) &&
    normalizarTexto(candidata.nombre) === normalizarTexto(nombreNuevo ?? "")
  ) {
    return { candidata, motivo: "nombre-y-zona", coincidencias };
  }

  const totalNuevo = dedupeProductos(nuevos).length;
  const base = Math.min(totalNuevo, candidata.productos.length);
  if (base > 0 && coincidencias >= 3 && coincidencias / base >= 0.8) {
    return { candidata, motivo: "menu-coincide", coincidencias };
  }

  return null;
}

/** Elige el duplicado más fuerte entre varias candidatas, si lo hay. */
export function buscarDuplicado(
  candidatas: CandidataDuplicada[],
  nuevos: ProductoComparable[],
  nombreNuevo: string | null | undefined,
  fotoHash: string,
): DuplicadoDetectado | null {
  const detectados = candidatas
    .map((c) => evaluarDuplicado(c, nuevos, nombreNuevo, fotoHash))
    .filter((d): d is DuplicadoDetectado => d !== null);
  if (detectados.length === 0) return null;
  const peso: Record<MotivoDuplicado, number> = {
    "foto-identica": 3,
    "nombre-y-zona": 2,
    "menu-coincide": 1,
  };
  detectados.sort(
    (a, b) =>
      peso[b.motivo] - peso[a.motivo] ||
      (a.candidata.distancia_m ?? Infinity) - (b.candidata.distancia_m ?? Infinity),
  );
  return detectados[0];
}
