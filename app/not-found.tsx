import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">No encontramos esta página</h1>
      <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">
        El enlace puede estar roto o la tienda ya no está disponible.
      </p>
      <Link href="/buscar" className="inline-flex min-h-11 items-center rounded-full bg-mercado-700 px-5 py-3 text-base font-semibold text-white">
        Buscar en tu barrio
      </Link>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-mercado-800 underline-offset-4 hover:underline dark:text-mercado-300">
        Ir al inicio
      </Link>
    </div>
  );
}
