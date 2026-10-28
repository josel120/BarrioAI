import Link from "next/link";
import { CameraIcon } from "@/components/icons";
import { HomeStats } from "@/components/HomeStats";

const SUGERENCIAS = [
  "Pollo a la brasa",
  "Ceviche",
  "Anticuchos",
  "Pan francés",
  "Bodega",
  "Corte de pelo",
];

const PASOS = [
  {
    titulo: "Busca un antojo",
    detalle: "Escribe lo que se te antoja o lo que necesitas.",
  },
  {
    titulo: "Encuentra lo más cercano",
    detalle: "Vemos tiendas de tu barrio con precios y distancia.",
  },
  {
    titulo: "Pide por WhatsApp",
    detalle: "Toca el botón de WhatsApp en el resultado y coordina tu pedido.",
  },
  {
    titulo: "Compra en tu barrio",
    detalle: "Camina a la tienda y compra directo.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 pt-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-balance">
          Lo que vende tu barrio, a un toque
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">
          Busca antojos, bodegas y servicios cerca de ti. Al buscar te pediremos tu ubicación para mostrarte lo más cercano.
        </p>
        <HomeStats />
        <div className="rounded-2xl bg-mercado-50 p-4 dark:bg-mercado-950" aria-label="Ejemplo de resultado">
          <p className="text-xs font-semibold text-mercado-800 dark:text-mercado-300">Así se ve un resultado</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-semibold">Pollo a la brasa 1/4</span>
            <span aria-hidden="true" className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700" />
            <span className="shrink-0 font-bold tabular-nums text-mercado-700 dark:text-mercado-500">S/ 18.00</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Pollería de tu barrio <span className="tabular-nums">· 350 m</span></p>
        </div>
      </div>

      <form action="/buscar" method="get" role="search" className="flex gap-2">
        <label htmlFor="q-home" className="sr-only">
          Buscar en tu barrio
        </label>
        <input
          id="q-home"
          name="q"
          type="search"
          required
          minLength={2}
          maxLength={100}
          placeholder="Pollo a la brasa, ceviche, bodega…"
          autoComplete="off"
          inputMode="search"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-mercado-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-mercado-800"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGERENCIAS.map((s) => (
          <Link
            key={s}
            href={`/buscar?q=${encodeURIComponent(s)}`}
            className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-mercado-600 hover:text-mercado-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-mercado-500 dark:hover:text-mercado-500"
          >
            {s}
          </Link>
        ))}
      </div>


      <section aria-labelledby="como-titulo" className="flex flex-col gap-1">
        <h2 id="como-titulo" className="text-lg font-bold">
          Cómo funciona
        </h2>
        <ol className="flex flex-col">
          {PASOS.map((paso, i) => (
            <li
              key={paso.titulo}
              className="flex gap-3 border-b border-zinc-200 py-3 last:border-b-0 dark:border-zinc-800"
            >
              <span
                aria-hidden="true"
                className="text-lg font-extrabold tabular-nums text-mercado-700 dark:text-mercado-500"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="font-semibold">{paso.titulo}</p>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {paso.detalle}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="vender-titulo"
        className="flex flex-col gap-3 rounded-2xl bg-mercado-50 p-5 dark:bg-mercado-950"
      >
        <div className="flex items-center gap-2 text-mercado-900 dark:text-mercado-100">
          <CameraIcon className="h-5 w-5" />
          <h2 id="vender-titulo" className="text-lg font-bold">
            ¿Tienes un negocio?
          </h2>
        </div>
        <p className="text-sm leading-6 text-mercado-900/80 dark:text-mercado-100/80">
          Fotografía tu menú o pizarrón y aparece en las búsquedas de tus
          vecinos.
        </p>
        <Link
          href="/vender"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-mercado-700 px-5 py-3 text-center text-base font-semibold text-mercado-800 transition-colors hover:bg-mercado-100 dark:border-mercado-500 dark:text-mercado-300 dark:hover:bg-mercado-900"
        >
          Publicar mi menú
        </Link>
        <Link
          href="/subir"
          className="text-center text-sm font-semibold text-mercado-800 underline-offset-4 hover:underline dark:text-mercado-200"
        >
          Actualizar un menú existente
        </Link>
      </section>
    </div>
  );
}
