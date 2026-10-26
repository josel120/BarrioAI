"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

type GeoStatus = "listo" | "localizando" | "denegado" | "no-disponible";

interface MenuItem {
  name: string;
  price: number | null;
  category?: string;
  description?: string | null;
}

interface UploadSuccess {
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
      const formData = new FormData();
      formData.append("image", image);
      if (tiendaId.trim() !== "") formData.append("tiendaId", tiendaId.trim());
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
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-5"
    >
      {/* 1. Foto del menú */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="menu-photo"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Foto del menú o pizarrón
        </label>
        <input
          id="menu-photo"
          name="menu-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageChange}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 file:mr-3 file:rounded-full file:border-0 file:bg-green-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <p className="text-sm text-zinc-500">Toma una foto (máx. 8 MB).</p>
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
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Ubicación de tu negocio
        </p>
        <p
          role="status"
          className={
            geoStatus === "listo"
              ? "text-sm font-medium text-green-700"
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
                placeholder="19.4326"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
                placeholder="-99.1332"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
        <div className="flex flex-col gap-1">
          <label
            htmlFor="nombre"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Nombre del negocio (opcional)
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Taquería El Barrio"
            autoComplete="organization"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tiendaId"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            ID de tienda (opcional, para actualizar)
          </label>
          <input
            id="tiendaId"
            name="tiendaId"
            type="text"
            value={tiendaId}
            onChange={(e) => setTiendaId(e.target.value)}
            placeholder="Pégalo aquí si ya tienes una tienda"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </div>

      {/* 4. Enviar */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-full bg-green-700 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
      >
        {submitting ? "Subiendo…" : "Subir menú"}
      </button>

      {submitError !== null && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {submitError}
        </p>
      )}

      {result !== null && (
        <section
          aria-live="polite"
          className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
        >
          <p className="text-base font-semibold text-green-800 dark:text-green-200">
            ¡Menú publicado!
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Tienda: <span className="font-mono">{result.tienda_id}</span>
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Productos guardados: {result.productos_insertados}
            {result.data.store_name !== null &&
              ` · ${result.data.store_name}`}
            {` · ${result.data.currency}`}
          </p>
          {result.data.items.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1.5">
              {result.data.items.map((item) => (
                <li
                  key={`${item.name}-${item.price ?? "sin-precio"}`}
                  className="flex items-baseline justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-100"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="shrink-0 text-zinc-600 dark:text-zinc-300">
                    {item.price !== null
                      ? `$${item.price} ${result.data.currency}`
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
