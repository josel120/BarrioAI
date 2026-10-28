"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { formatPrecio } from "@/lib/formatPrecio";
import { ResultsSkeleton } from "@/components/SearchSkeletons";
import { LocationPicker } from "@/components/LocationPicker";

type GeoStatus = "idle" | "listo" | "localizando" | "denegado" | "no-disponible";

interface MenuItem { name: string; price: number | null; category?: string; description?: string | null }
interface UploadSuccess {
  claim_token?: string; success: boolean; tienda_id: string; productos_insertados: number;
  data: { store_name: string | null; currency: string; items: MenuItem[] };
}
interface ExtractData { store_name: string | null; currency: string; items: MenuItem[] }
interface Coords { lat: number; lng: number }

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const COMPRESS_MAX_DIM = 1024;

const GEO_MESSAGES: Record<GeoStatus, string> = {
  idle: "Todavía no elegiste la ubicación de tu negocio.",
  listo: "Ubicación lista.",
  localizando: "Localizando tu ubicación…",
  denegado: "Permiso de ubicación denegado. Elige tu zona o ingresa las coordenadas.",
  "no-disponible": "Ubicación no disponible en este dispositivo. Elige tu zona o ingresa las coordenadas.",
};

function parseLat(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
}
function parseLng(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
}

function messageForStatus(status: number): string {
  switch (status) {
    case 400: return "Datos inválidos: verifica la imagen y las coordenadas.";
    case 401: return "Falta el código de tu tienda. Pégalo en el paso 3 para actualizarla.";
    case 403: return "El código de tienda no es válido. Revísalo e intenta de nuevo.";
    case 404: return "No se encontró la tienda indicada. Verifica el ID de tienda.";
    case 413: return "La imagen supera el tamaño permitido. Elige una foto más pequeña.";
    case 422: return "No se detectaron productos en la imagen. Toma otra foto del menú, con buena luz y texto legible.";
    case 429: return "Demasiadas subidas. Espera un momento e intenta de nuevo.";
    case 502: return "La IA devolvió una respuesta inválida. Intenta de nuevo.";
    case 500: return "Error interno del servidor. Intenta más tarde.";
    default: return `Error inesperado (${status}). Intenta de nuevo.`;
  }
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, COMPRESS_MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
  canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.82));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

export default function MenuUploadForm() {
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tiendaId, setTiendaId] = useState("");
  const [claimToken, setClaimToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("Subiendo tu menú");
  const [result, setResult] = useState<UploadSuccess | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [review, setReview] = useState<ExtractData | null>(null);
  const [copiado, setCopiado] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewsRef = useRef<string[]>([]);

  const requestLocation = useCallback(() => {
    setGeoStatus("localizando");
    if (typeof navigator === "undefined" || !("geolocation" in navigator) || !navigator.geolocation) {
      setGeoStatus("no-disponible");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoStatus("listo"); },
      (err) => setGeoStatus(err.code === err.PERMISSION_DENIED ? "denegado" : "no-disponible"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => () => { previewsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    setResult(null); setSubmitError(null); setReview(null);
    if (files.length === 0) return;
    for (const file of files) {
      if (!file.type.startsWith("image/")) { setImageError("Todos los archivos deben ser imágenes."); return; }
      if (file.size > MAX_IMAGE_BYTES) { setImageError("Una imagen supera los 8 MB. Elige una más pequeña."); return; }
    }
    setImageError(null);
    previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = files.map((f) => URL.createObjectURL(f));
    previewsRef.current = urls;
    setImages(files); setPreviewUrls(urls);
  };

  const quitarFoto = () => {
    previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    previewsRef.current = []; setImages([]); setPreviewUrls([]); setReview(null);
  };

  const handleManualLat = (value: string) => {
    setManualLat(value);
    const lat = parseLat(value); const lng = parseLng(manualLng);
    setCoords(lat !== null && lng !== null ? { lat, lng } : null);
  };
  const handleManualLng = (value: string) => {
    setManualLng(value);
    const lat = parseLat(manualLat); const lng = parseLng(value);
    setCoords(lat !== null && lng !== null ? { lat, lng } : null);
  };

  async function prepararFoto(file: File): Promise<Blob> {
    let payload: Blob = file;
    try { payload = await compressImage(file); } catch { payload = file; }
    if (payload.size > MAX_UPLOAD_BYTES) throw new Error("La foto sigue siendo muy grande después de optimizarla. Elige una más pequeña.");
    return payload;
  }

  async function extraer() {
    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true); setSubmitError(null); setResult(null); setStage("Extrayendo productos de tu foto");
    try {
      const merged: MenuItem[] = [];
      let storeName: string | null = null; let currency = "PEN";
      for (const file of images) {
        const payload = await prepararFoto(file);
        const formData = new FormData();
        formData.append("image", payload, "menu.jpg");
        formData.append("phase", "extract");
        formData.append("lat", String(coords!.lat)); formData.append("lng", String(coords!.lng));
        const res = await fetch("/api/upload", { method: "POST", body: formData, signal: controller.signal });
        if (!res.ok) {
          let serverError = "";
          try { const j = (await res.json()) as { error?: unknown }; if (typeof j?.error === "string") serverError = j.error; } catch { serverError = ""; }
          throw new Error(serverError || messageForStatus(res.status));
        }
        const json = (await res.json()) as { data: ExtractData };
        storeName = storeName ?? json.data.store_name; currency = json.data.currency;
        for (const item of json.data.items) if (!merged.some((m) => m.name.toLowerCase() === item.name.toLowerCase())) merged.push(item);
      }
      if (merged.length === 0) throw new Error(messageForStatus(422));
      setReview({ store_name: storeName, currency, items: merged });
      if (storeName && !nombre) setNombre(storeName);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setSubmitError(err instanceof Error ? err.message : "Error de red. Revisa tu conexión e intenta de nuevo.");
    } finally { setSubmitting(false); abortRef.current = null; }
  }

  async function publicar() {
    if (!review) return;
    const limpios = review.items.map((i) => ({ ...i, name: i.name.trim() })).filter((i) => i.name !== "");
    if (limpios.length === 0) { setSubmitError("Agrega al menos un producto antes de publicar."); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true); setSubmitError(null); setStage("Publicando tu menú");
    try {
      const payload = await prepararFoto(images[0]);
      const formData = new FormData();
      formData.append("image", payload, "menu.jpg");
      formData.append("items", JSON.stringify({ store_name: review.store_name, currency: review.currency, items: limpios }));
      if (tiendaId.trim() !== "") formData.append("tiendaId", tiendaId.trim());
      if (claimToken.trim() !== "") formData.append("claimToken", claimToken.trim());
      if (nombre.trim() !== "") formData.append("nombre", nombre.trim());
      if (telefono.trim() !== "") formData.append("telefono", telefono.trim());
      if (direccion.trim() !== "") formData.append("direccion", direccion.trim());
      formData.append("lat", String(coords!.lat)); formData.append("lng", String(coords!.lng));
      const res = await fetch("/api/upload", { method: "POST", body: formData, signal: controller.signal });
      if (res.status === 201) { setResult((await res.json()) as UploadSuccess); return; }
      let serverError = "";
      try { const j = (await res.json()) as { error?: unknown }; if (typeof j?.error === "string") serverError = j.error; } catch { serverError = ""; }
      throw new Error(serverError || messageForStatus(res.status));
    } catch (err) {
      if ((err as Error).name !== "AbortError") setSubmitError(err instanceof Error ? err.message : "Error de red. Revisa tu conexión e intenta de nuevo.");
    } finally { setSubmitting(false); abortRef.current = null; }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (images.length === 0 || !coords || submitting) return;
    if (review) await publicar(); else await extraer();
  };

  const faltan: string[] = [];
  if (images.length === 0) faltan.push("la foto de tu menú");
  if (!coords) faltan.push("la ubicación de tu negocio");
  const canSubmit = faltan.length === 0 && !submitting;
  const showManual = geoStatus !== "listo";

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span aria-hidden="true" className="text-base font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500">1</span>
          <label htmlFor="menu-photo" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Foto del menú o pizarrón</label>
        </div>
        <input id="menu-photo" name="menu-photo" type="file" accept="image/*" capture="environment" multiple onChange={handleImageChange} aria-describedby="foto-ayuda foto-error" aria-invalid={imageError ? true : undefined} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 file:mr-3 file:rounded-full file:border-0 file:bg-mercado-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
        <p id="foto-ayuda" className="text-sm text-zinc-600 dark:text-zinc-300">Hasta 3 fotos. Encadra todo el menú, con buena luz y texto legible, sin reflejos (máx. 8 MB cada una, se optimizan al subir).</p>
        {imageError !== null && <p id="foto-error" role="alert" className="text-sm font-medium text-red-600">{imageError}</p>}
        {previewUrls.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`Vista previa del menú ${i + 1}`} className="max-h-64 w-full rounded-lg border border-zinc-200 object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:border-zinc-700" />
              ))}
            </div>
            <button type="button" onClick={quitarFoto} className="inline-flex min-h-11 items-center self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600">Quitar fotos y tomar otra</button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span aria-hidden="true" className="text-base font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500">2</span>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Ubicación de tu negocio</p>
        </div>
        <p role="status" className={geoStatus === "listo" ? "text-sm font-medium text-mercado-700 dark:text-mercado-500" : geoStatus === "localizando" ? "text-sm text-zinc-600 dark:text-zinc-300" : "text-sm font-medium text-amber-700 dark:text-amber-300"}>{GEO_MESSAGES[geoStatus]}</p>
        <LocationPicker coords={coords} error={null} locating={geoStatus === "localizando"} onRequest={requestLocation} onManual={(c) => { setCoords(c); setGeoStatus("listo"); }} idPrefix="subir-zona" />
        {showManual && (
          <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <summary className="min-h-11 cursor-pointer text-sm font-semibold">Ingresar coordenadas manualmente (avanzado)</summary>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="lat" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Latitud (-90 a 90)</label>
                <input id="lat" name="lat" type="number" inputMode="decimal" step="any" min={-90} max={90} value={manualLat} onChange={(e) => handleManualLat(e.target.value)} placeholder="-12.0464" aria-describedby="coord-ayuda" aria-invalid={manualLat !== "" && parseLat(manualLat) === null ? true : undefined} className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="lng" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Longitud (-180 a 180)</label>
                <input id="lng" name="lng" type="number" inputMode="decimal" step="any" min={-180} max={180} value={manualLng} onChange={(e) => handleManualLng(e.target.value)} placeholder="-77.0428" aria-describedby="coord-ayuda" aria-invalid={manualLng !== "" && parseLng(manualLng) === null ? true : undefined} className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
            </div>
            <p id="coord-ayuda" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Ejemplo Lima: -12.0464, -77.0428. Si un valor no es válido, no podremos ubicar tu tienda.</p>
          </details>
        )}
        {coords !== null && <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span aria-hidden="true" className="text-base font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500">3</span>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Datos de tu negocio <span className="font-normal text-zinc-500">(opcional)</span></p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Nombre del negocio</label>
          <input id="nombre" name="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Taquería El Barrio" autoComplete="organization" className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="telefono" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">WhatsApp de la tienda</label>
          <input id="telefono" name="telefono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej. 999 888 777" autoComplete="tel" inputMode="tel" aria-describedby="telefono-ayuda" className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
          <p id="telefono-ayuda" className="text-sm text-zinc-600 dark:text-zinc-300">Recomendado: tus vecinos te pedirán por WhatsApp. Si no tienes, déjalo en blanco y publica igual.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="direccion" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Dirección de la tienda</label>
          <input id="direccion" name="direccion" type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. Ejemplo 123, tu barrio" autoComplete="street-address" maxLength={200} className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tiendaId" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">ID de tienda</label>
          <input id="tiendaId" name="tiendaId" type="text" value={tiendaId} onChange={(e) => setTiendaId(e.target.value)} placeholder="Pégalo aquí si ya tienes una tienda" autoComplete="off" className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="claimToken" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Código de tu tienda</label>
          <input id="claimToken" name="claimToken" type="text" value={claimToken} onChange={(e) => setClaimToken(e.target.value)} placeholder="Requerido si actualizas una tienda existente" autoComplete="off" aria-describedby="codigo-ayuda" className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900" />
          <p id="codigo-ayuda" className="text-sm text-zinc-600 dark:text-zinc-300">Te lo dimos al publicar por primera vez. Sin él no podemos actualizar tu tienda.</p>
        </div>
      </div>

      {review && (
        <section aria-labelledby="revision-titulo" className="flex flex-col gap-3 rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950">
          <h2 id="revision-titulo" className="text-base font-bold">4 · Revisa antes de publicar</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">Corrige nombres y precios. Lo que dejes aquí es lo que verán tus vecinos.</p>
          <ul className="flex flex-col gap-2">
            {review.items.map((item, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`rev-nombre-${idx}`}>Nombre del producto {idx + 1}</label>
                <input id={`rev-nombre-${idx}`} value={item.name} onChange={(e) => setReview({ ...review, items: review.items.map((it, i) => i === idx ? { ...it, name: e.target.value } : it) })} className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                <label className="sr-only" htmlFor={`rev-precio-${idx}`}>Precio del producto {idx + 1}</label>
                <input id={`rev-precio-${idx}`} type="number" inputMode="decimal" min={0} step="0.01" value={item.price ?? ""} placeholder="Sin precio" onChange={(e) => setReview({ ...review, items: review.items.map((it, i) => i === idx ? { ...it, price: e.target.value === "" ? null : Number(e.target.value) } : it) })} className="min-h-11 w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
                <button type="button" onClick={() => setReview({ ...review, items: review.items.filter((_, i) => i !== idx) })} className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-600">Quitar</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setReview({ ...review, items: [...review.items, { name: "", price: null, category: "Otros", description: null }] })} className="inline-flex min-h-11 items-center self-start rounded-full border border-mercado-700 px-4 py-2 text-sm font-semibold text-mercado-800 dark:border-mercado-500 dark:text-mercado-300">Agregar producto</button>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={!canSubmit} aria-describedby={faltan.length ? "faltan" : undefined} className="min-h-11 w-full rounded-full bg-mercado-700 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-mercado-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300">
          {review ? "Publicar menú revisado" : "Revisar productos de la foto"}
        </button>
        {faltan.length > 0 && <p id="faltan" className="text-sm text-zinc-600 dark:text-zinc-300">Te falta: {faltan.join(" y ")}.</p>}
        {submitting && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex min-h-11 items-center self-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600">Cancelar</button>
        )}
      </div>

      {submitting && <ResultsSkeleton rows={2} />}
      <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">{submitting ? `${stage}…` : ""}</p>
      {submitError !== null && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm font-medium text-red-600">{submitError}</p>
          <button type="button" onClick={() => { setSubmitError(null); }} className="inline-flex min-h-11 items-center self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600">Entendido, corregir</button>
        </div>
      )}

      {result !== null && (
        <section aria-live="polite" className="flex flex-col gap-2 rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950">
          <p className="text-base font-semibold text-mercado-900 dark:text-mercado-100">¡Menú publicado!</p>
          <p className="break-all text-sm text-zinc-700 dark:text-zinc-200">Tienda: <span className="font-mono">{result.tienda_id}</span></p>
          {result.claim_token && (
            <div className="flex flex-col gap-2">
              <p className="break-all text-sm text-zinc-700 dark:text-zinc-200">Guarda tu código de tienda: <span className="font-mono font-bold">{result.claim_token}</span>. Lo necesitarás para actualizar tu menú.</p>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(result.claim_token!); setCopiado(true); } catch { setCopiado(false); } }} className="inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">{copiado ? "Código copiado" : "Copiar código"}</button>
              {copiado && <p className="text-sm text-mercado-800 dark:text-mercado-300">Código copiado. Guárdalo en un lugar seguro.</p>}
            </div>
          )}
          <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-200">Productos guardados: {result.productos_insertados}{result.data.store_name !== null && ` ? ${result.data.store_name}`}{` ? ${result.data.currency}`}</p>
          <Link href={`/tienda/${result.tienda_id}`} className="inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">Ver mi tienda</Link>
          {result.data.items.length > 0 && (
            <ul className="mt-1 flex flex-col divide-y divide-mercado-100 dark:divide-mercado-900">
              {result.data.items.map((item) => (
                <li key={`${item.name}-${item.price ?? "sin-precio"}`} className="flex items-baseline gap-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-100">
                  <span className="min-w-0 flex-initial truncate font-medium">{item.name}</span>
                  <span aria-hidden="true" className="min-w-4 flex-1 border-b-2 border-dotted border-mercado-200 dark:border-mercado-800" />
                  <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">{item.price !== null ? formatPrecio(item.price, result.data.currency) : "Sin precio"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </form>
  );
}
