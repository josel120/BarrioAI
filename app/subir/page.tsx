import type { Metadata } from "next";
import MenuUploadForm from "@/components/MenuUploadForm";

export const metadata: Metadata = {
  title: "Subir menú | BarrioAI",
  description:
    "Toma una foto de tu menú o pizarrón y publícalo en BarrioAI para que te encuentren.",
};

export default function SubirPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 pt-8 pb-24 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-stretch gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sube tu menú
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Una foto de tu menú o pizarrón y tu ubicación. Nosotros hacemos el
            resto.
          </p>
        </div>
        <MenuUploadForm />
      </main>
    </div>
  );
}
