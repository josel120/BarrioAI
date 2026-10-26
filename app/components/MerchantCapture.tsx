"use client";

import { useRef, useState, useCallback } from "react";

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

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Menú"
          className="w-full max-w-sm aspect-[3/4] object-cover rounded-2xl shadow-lg"
        />
      ) : (
        <div className="w-full max-w-sm aspect-[3/4] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-center p-6 border-2 border-dashed">
          Fotografía tu menú o pizarrón
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "locating" || status === "uploading"}
        className="w-full max-w-sm bg-green-600 active:bg-green-700 text-white font-bold py-4 px-6 rounded-full text-lg shadow-lg disabled:opacity-60 fixed bottom-6 sm:static"
      >
        {status === "locating"
          ? "📍 Obteniendo ubicación..."
          : status === "uploading"
            ? "🤖 BarrioAI creando tu tienda..."
            : "📸 Tomar Foto del Menú"}
      </button>

      {status === "success" && (
        <p className="text-green-700 font-semibold bg-green-50 p-3 rounded-lg">
          ✅ ¡Tienda creada! {count} productos digitalizados.
        </p>
      )}
      {error && (
        <p className="text-red-600 bg-red-50 p-3 rounded-lg w-full max-w-sm text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
