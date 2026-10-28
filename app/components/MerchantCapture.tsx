"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { CameraIcon } from "@/components/icons";
import { LocationPicker } from "@/components/LocationPicker";
import { useGeolocation } from "@/lib/hooks/useGeolocation";

type Status = "idle" | "extracting" | "review" | "success" | "error";
interface Item { name: string; price: number | null; category?: string; description?: string | null }
interface UploadResponse { success: true; tienda_id: string; productos_insertados: number; claim_token?: string }

async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No pudimos procesar la foto. Toma otra con buena luz e inténtalo de nuevo.");
  }
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.82));
}

export default function MerchantCapture({ onSuccess }: { onSuccess?: (r: UploadResponse) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const { coords, error: geoError, locating, request, setManual } = useGeolocation({ auto: false });
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [currency, setCurrency] = useState("PEN");
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const busy = status === "extracting" || publishing;

  const extraer = useCallback(async (file: File) => {
    if (!coords) { setError("Primero usa tu ubicación o elige tu zona, y luego toma la foto."); return; }
    setError(null); setStatus("extracting");
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("image", compressed, "menu.jpg");
      form.append("phase", "extract");
      form.append("lat", String(coords.lat)); form.append("lng", String(coords.lng));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No pudimos leer tu menú. Toma otra foto con buena luz.");
      setItems(data.data.items as Item[]); setCurrency(data.data.currency as string);
      setStatus("review");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error && /[áéíóúñ¿¡]/i.test(err.message)
          ? err.message
          : "No pudimos subir tu foto. Revisa tu conexión e intenta de nuevo.",
      );
    }
  }, [coords]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    setPreview(URL.createObjectURL(file));
    void extraer(file);
  }, [extraer]);

  async function publicar() {
    if (!fileRef.current || !coords) return;
    const limpios = items.map((i) => ({ ...i, name: i.name.trim() })).filter((i) => i.name !== "");
    if (limpios.length === 0) { setError("Agrega al menos un producto antes de publicar."); return; }
    setError(null); setPublishing(true);
    try {
      const compressed = await compressImage(fileRef.current);
      const form = new FormData();
      form.append("image", compressed, "menu.jpg");
      form.append("items", JSON.stringify({ store_name: null, currency, items: limpios }));
      form.append("lat", String(coords.lat)); form.append("lng", String(coords.lng));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No pudimos publicar. Intenta de nuevo.");
      setPublishing(false); setResult(data as UploadResponse); setStatus("success"); onSuccess?.(data);
    } catch (err) {
      setPublishing(false);
      setStatus("error");
      setError(err instanceof Error ? err.message : "No pudimos publicar. Intenta de nuevo.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Publica tu menú</h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">Una foto de tu menú o pizarrón. Nosotros lo digitalizamos y tú lo revisas antes de publicar.</p>
      </div>

      <LocationPicker coords={coords} error={geoError} locating={locating} onRequest={request} onManual={setManual} idPrefix="vender-zona" />

      <input ref={inputRef} id="menu-foto" type="file" accept="image/*" capture="environment" aria-label="Foto del menú o pizarrón" className="hidden" onChange={handleFile} />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa del menú fotografiado" className="aspect-[3/4] w-full rounded-2xl border border-zinc-200 object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:border-zinc-800" />
      ) : (
        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <CameraIcon className="h-10 w-10 text-zinc-500" />
          <p className="max-w-55 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Fotografía tu menú o pizarrón con buena luz y texto legible</p>
        </div>
      )}

      {status !== "review" && status !== "success" && (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="min-h-11 w-full rounded-full bg-mercado-700 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-mercado-800 disabled:cursor-not-allowed disabled:opacity-60">
          {status === "extracting" ? "Leyendo tu menú…" : "Tomar foto del menú"}
        </button>
      )}
      {preview && status !== "review" && status !== "success" && (
        <button type="button" onClick={() => { setPreview(null); fileRef.current = null; }} className="inline-flex min-h-11 items-center self-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600">Quitar foto</button>
      )}

      {status === "review" && (
        <section aria-labelledby="rev-vender" className="flex flex-col gap-3 rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950">
          <h2 id="rev-vender" className="text-base font-bold">Revisa antes de publicar</h2>
          <ul className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`v-nombre-${idx}`}>Nombre del producto {idx + 1}</label>
                <input id={`v-nombre-${idx}`} value={item.name} onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))} className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                <label className="sr-only" htmlFor={`v-precio-${idx}`}>Precio del producto {idx + 1}</label>
                <input id={`v-precio-${idx}`} type="number" inputMode="decimal" min={0} step="0.01" value={item.price ?? ""} placeholder="Sin precio" onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, price: e.target.value === "" ? null : Number(e.target.value) } : it))} className="min-h-11 w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
                <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-600">Quitar</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setItems([...items, { name: "", price: null, category: "Otros", description: null }])} className="inline-flex min-h-11 items-center self-start rounded-full border border-mercado-700 px-4 py-2 text-sm font-semibold text-mercado-800 dark:border-mercado-500 dark:text-mercado-300">Agregar producto</button>
          <button type="button" onClick={() => void publicar()} disabled={busy} className="min-h-11 w-full rounded-full bg-mercado-700 px-5 py-3 text-base font-semibold text-white disabled:opacity-60">{publishing ? "Publicando…" : "Publicar menú revisado"}</button>
        </section>
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {status === "success" && result && (
          <div className="flex flex-col gap-2 rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950">
            <p className="font-semibold text-mercado-900 dark:text-mercado-100">Tu tienda ya está en BarrioAI</p>
            <p className="text-sm leading-6 text-mercado-900/80 dark:text-mercado-100/80">Digitalizamos <span className="tabular-nums">{result.productos_insertados}</span> {result.productos_insertados === 1 ? "producto" : "productos"} de tu foto.</p>
            {result.claim_token && (
              <>
                <p className="break-all text-sm text-zinc-700 dark:text-zinc-200">Guarda tu código de tienda: <span className="font-mono font-bold">{result.claim_token}</span></p>
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(result.claim_token!); setCopiado(true); } catch { setCopiado(false); } }} className="inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">{copiado ? "Código copiado" : "Copiar código"}</button>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href={`/tienda/${result.tienda_id}`} className="inline-flex min-h-11 items-center rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">Ver mi tienda</Link>
              <Link href="/buscar" className="inline-flex min-h-11 items-center text-sm font-semibold text-mercado-800 underline-offset-4 hover:underline dark:text-mercado-200">Ver cómo te encuentran tus vecinos</Link>
            </div>
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      </div>

      <p className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">Al publicar aceptas que tu menú sea visible en las búsquedas cercanas.</p>
    </div>
  );
}
