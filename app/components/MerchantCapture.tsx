"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { CameraIcon } from "@/components/icons";

type Status = "idle" | "locating" | "uploading" | "success" | "error";
interface UploadResponse {
  success: true;
  tienda_id: string;
  productos_insertados: number;
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((res) =>
    canvas.toBlob((b) => res(b!), "image/jpeg", 0.82),
  );
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }),
  );
}

const BUSY_LABEL: Record<string, string> = {
  locating: "Obteniendo ubicación…",
  uploading: "Creando tu tienda…",
};

export default function MerchantCapture({
  onSuccess,
}: {
  onSuccess?: (r: UploadResponse) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPreview(URL.createObjectURL(file));
      setError(null);

      try {
        setStatus("locating");
        const [compressed, pos] = await Promise.all([
          compressImage(file),
          getPosition(),
        ]);

        setStatus("uploading");
        const form = new FormData();
        form.append("image", compressed, "menu.jpg");
        form.append("lat", String(pos.coords.latitude));
        form.append("lng", String(pos.coords.longitude));

        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al subir");

        setCount(data.productos_insertados);
        setStatus("success");
        onSuccess?.(data);
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof GeolocationPositionError
            ? "Activa tu GPS para registrar tu tienda."
            : (err as Error).message,
        );
      }
    },
    [onSuccess],
  );

  const busy = status === "locating" || status === "uploading";

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Publica tu menú
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">
          Una foto de tu menú o pizarrón. Nosotros lo digitalizamos.
        </p>
      </div>

      <input
        ref={inputRef}
        id="menu-foto"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Foto del menú o pizarrón"
        className="hidden"
        onChange={handleFile}
      />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Vista previa del menú fotografiado"
          className="aspect-[3/4] w-full rounded-2xl border border-zinc-200 object-cover dark:border-zinc-800"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <CameraIcon className="h-10 w-10 text-zinc-400" />
          <p className="max-w-55 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Fotografía tu menú o pizarrón con buena luz y texto legible
          </p>
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full rounded-full bg-mercado-700 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-mercado-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? BUSY_LABEL[status] : "Tomar foto del menú"}
      </button>

      <div aria-live="polite" className="flex flex-col gap-3">
        {(status === "locating" || status === "uploading") && (
          <p className="text-center text-sm text-zinc-500">
            {BUSY_LABEL[status]} Esto puede tardar unos segundos.
          </p>
        )}
        {status === "success" && (
          <div className="flex flex-col gap-1 rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950">
            <p className="font-semibold text-mercado-900 dark:text-mercado-100">
              Tu tienda ya está en BarrioAI
            </p>
            <p className="text-sm leading-6 text-mercado-900/80 dark:text-mercado-100/80">
              Digitalizamos {count}{" "}
              {count === 1 ? "producto" : "productos"} de tu foto.
            </p>
            <Link
              href="/buscar"
              className="mt-1 text-sm font-semibold text-mercado-800 underline-offset-4 hover:underline dark:text-mercado-200"
            >
              Ver cómo te encuentran tus vecinos
            </Link>
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
      </div>

      <p className="text-center text-xs leading-5 text-zinc-400">
        Al publicar aceptas que tu menú sea visible en las búsquedas cercanas.
      </p>
    </main>
  );
}
