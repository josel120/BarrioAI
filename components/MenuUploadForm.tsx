"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { formatPrecio } from "@/lib/formatPrecio";
import { TimedLoading } from "@/components/Loading";

type GeoStatus = "listo" | "localizando" | "denegado" | "no-disponible";

interface MenuItem {
  name: string;
  price: number | null;
  category?: string;
  description?: string | null;
}

interface UploadSuccess {
  claim_token?: string;
  success: boolean;
  tienda_id: string;
  productos_insertados: number;
  data: {
    store_name: string | null;
    currency: string;
    items: MenuItem[];
  };
}

interface Coords {
  lat: number;
  lng: number;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Vercel rejects request bodies > 4.5MB at the platform layer
// (FUNCTION_PAYLOAD_TOO_LARGE), below the API's own 8MB limit.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const COMPRESS_MAX_DIM = 1024;

const GEO_MESSAGES: Record<GeoStatus, string> = {
  listo: "Ubicación lista.",
  localizando: "Localizando tu ubicación…",
  denegado: "Permiso de ubicación denegado. Ingresa tu ubicación manualmente.",
  "no-disponible":
    "Ubicación no disponible en este dispositivo. Ingresa tu ubicación manualmente.",
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
    case 400:
      return "Datos inválidos: verifica la imagen y las coordenadas.";
    case 413:
      return "La imagen supera los 8 MB. Elige una foto más pequeña.";
    case 422:
      return "No se detectaron productos en la imagen. Toma otra foto del menú.";
    case 502:
      return "La IA devolvió una respuesta inválida. Intenta de nuevo.";
    case 500:
      return "Error interno del servidor. Intenta más tarde.";
    default:
      return `Error inesperado (${status}). Intenta de nuevo.`;
  }
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    COMPRESS_MAX_DIM / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
  canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/jpeg", 0.82),
  );
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

export default function MenuUploadForm() {
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("localizando");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [nombre, setNombre] = useState("");
  const [tiendaId, setTiendaId] = useState("");
  const [claimToken, setClaimToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadSuccess | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const requestLocation = useCallback(() => {
    setGeoStatus("localizando");
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator) ||
      !navigator.geolocation
    ) {
      setGeoStatus("no-disponible");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("listo");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denegado");
        } else {
          setGeoStatus("no-disponible");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    // Deferred so the effect body never calls setState synchronously
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(requestLocation, 0);
    return () => clearTimeout(timer);
  }, [requestLocation]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setResult(null);
    setSubmitError(null);
    if (!file) {
      setImage(null);
      setImageError(null);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setImage(null);
      setImageError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImage(null);
      setImageError("La imagen supera los 8 MB. Elige una más pequeña.");
      return;
    }
    setImageError(null);
    setImage(file);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewUrl(url);
  };

  const handleManualLat = (value: string) => {
    setManualLat(value);
    const lat = parseLat(value);
    const lng = parseLng(manualLng);
    setCoords(lat !== null && lng !== null ? { lat, lng } : null);
  };

  const handleManualLng = (value: string) => {
    setManualLng(value);
    const lat = parseLat(manualLat);
    const lng = parseLng(value);
    setCoords(lat !== null && lng !== null ? { lat, lng } : null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!image || !coords || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      // Client-side compression: never send the raw file, the hosting
      // platform caps request bodies below the API's own 8MB limit.
      let payload: Blob = image;
      try {
        payload = await compressImage(image);
      } catch {
        payload = image;
      }
      if (payload.size > MAX_UPLOAD_BYTES) {
        setSubmitError(
          "La foto sigue siendo muy grande después de optimizarla. Elige una más pequeña.",
        );
        return;
      }
      const formData = new FormData();
      formData.append("image", payload, "menu.jpg");
      if (tiendaId.trim() !== "") formData.append("tiendaId", tiendaId.trim());
      if (claimToken.trim() !== "") formData.append("claimToken", claimToken.trim());
      if (nombre.trim() !== "") formData.append("nombre", nombre.trim());
      formData.append("lat", String(coords.lat));
      formData.append("lng", String(coords.lng));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.status === 201) {
        const json = (await res.json()) as UploadSuccess;
        setResult(json);
        return;
      }

      let detail = "";
      try {
        const json = (await res.json()) as { error?: unknown };
        if (typeof json?.error === "string" && json.error !== "")
          detail = ` (${json.error})`;
      } catch {
        detail = "";
      }
      setSubmitError(`${messageForStatus(res.status)}${detail}`);
    } catch {
      setSubmitError("Error de red. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = image !== null && coords !== null && !submitting;
  const showManual = geoStatus === "denegado" || geoStatus === "no-disponible";

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      {/* 1. Foto del menú */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="text-base font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500"
          >
            1
          </span>
          <label
            htmlFor="menu-photo"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Foto del menú o pizarrón
          </label>
        </div>
        <input
          id="menu-photo"
          name="menu-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageChange}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 file:mr-3 file:rounded-full file:border-0 file:bg-mercado-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <p className="text-sm text-zinc-500">
          Toma una foto (máx. 8 MB, se optimiza al subir).
        </p>
        {imageError !== null && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {imageError}
          </p>
        )}
        {previewUrl !== null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Vista previa del menú"
            className="max-h-64 w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
          />
        )}
      </div>

      {/* 2. Ubicación */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="text-base font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500"
          >
            2
          </span>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Ubicación de tu negocio
          </p>
        </div>
        <p
          role="status"
          className={
            geoStatus === "listo"
              ? "text-sm font-medium text-mercado-700 dark:text-mercado-500"
              : geoStatus === "localizando"
                ? "text-sm text-zinc-500"
                : "text-sm font-medium text-amber-600"
          }
        >
          {GEO_MESSAGES[geoStatus]}
        </p>
        {geoStatus === "listo" && coords !== null && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}
        {showManual && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="lat"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Latitud (-90 a 90)
              </label>
              <input
                id="lat"
                name="lat"
                type="number"
                inputMode="decimal"
                step="any"
                min={-90}
                max={90}
                value={manualLat}
                onChange={(e) => handleManualLat(e.target.value)}
                placeholder="-12.0464"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="lng"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Longitud (-180 a 180)
              </label>
              <input
                id="lng"
                name="lng"
                type="number"
                inputMode="decimal"
                step="any"
                min={-180}
                max={180}
                value={manualLng}
                onChange={(e) => handleManualLng(e.target.value)}
                placeholder="-77.0428"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>
        )}
        {(geoStatus === "denegado" || geoStatus === "no-disponible") && (
          <button
            type="button"
            onClick={requestLocation}
            className="self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
          >
            Reintentar ubicación
          </button>
        )}
      </div>

      {/* 3. Datos opcionales */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="text-base font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500"
          >
            3
          </span>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Datos de tu negocio{" "}
            <span className="font-normal text-zinc-500">(opcional)</span>
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="nombre"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Nombre del negocio
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Taquería El Barrio"
            autoComplete="organization"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tiendaId"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            ID de tienda
          </label>
          <input
            id="tiendaId"
            name="tiendaId"
            type="text"
            value={tiendaId}
            onChange={(e) => setTiendaId(e.target.value)}
            placeholder="Pégalo aquí si ya tienes una tienda"
            autoComplete="off"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="claimToken" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Código de tu tienda
        </label>
        <input
          id="claimToken"
          name="claimToken"
          type="text"
          value={claimToken}
          onChange={(e) => setClaimToken(e.target.value)}
          placeholder="Requerido si actualizas una tienda existente"
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      {/* 4. Enviar */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-full bg-mercado-700 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-mercado-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
      >
        Subir menú
      </button>

      <TimedLoading active={submitting} label="Subiendo tu menú" expectedMs={20000} />
      {submitError !== null && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {submitError}
        </p>
      )}

      {result !== null && (
        <section
          aria-live="polite"
          className="flex flex-col gap-2 rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950"
        >
          <p className="text-base font-semibold text-mercado-900 dark:text-mercado-100">
            ¡Menú publicado!
          </p>
          <p className="truncate text-sm text-zinc-700 dark:text-zinc-200">
            Tienda: <span className="font-mono">{result.tienda_id}</span>
          </p>
          {result.claim_token && (
            <p role="alert" className="text-sm text-zinc-700 dark:text-zinc-200">
              Guarda tu código de tienda: <span className="font-mono font-bold">{result.claim_token}</span>. Lo necesitarás para actualizar tu menú.
            </p>
          )}
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Productos guardados: {result.productos_insertados}
            {result.data.store_name !== null &&
              ` · ${result.data.store_name}`}
            {` · ${result.data.currency}`}
          </p>
          {result.data.items.length > 0 && (
            <ul className="mt-1 flex flex-col divide-y divide-mercado-100 dark:divide-mercado-900">
              {result.data.items.map((item) => (
                <li
                  key={`${item.name}-${item.price ?? "sin-precio"}`}
                  className="flex items-baseline gap-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-100"
                >
                  <span className="min-w-0 flex-initial truncate font-medium">
                    {item.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className="min-w-4 flex-1 border-b-2 border-dotted border-mercado-200 dark:border-mercado-800"
                  />
                  <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {item.price !== null
                      ? formatPrecio(item.price, result.data.currency)
                      : "Sin precio"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </form>
  );
}
