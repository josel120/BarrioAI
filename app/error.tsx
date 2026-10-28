"use client";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Algo salió mal</h1>
      <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">
        No pudimos cargar esta parte. Revisa tu conexión e intenta de nuevo.
      </p>
      <button type="button" onClick={() => retry()} className="inline-flex min-h-11 items-center rounded-full bg-mercado-700 px-5 py-3 text-base font-semibold text-white">
        Reintentar
      </button>
    </div>
  );
}
