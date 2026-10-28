import type { Metadata } from "next";
import MenuUploadForm from "@/components/MenuUploadForm";

export const metadata: Metadata = {
  title: "Actualizar menú | BarrioAI",
  description:
    "Sube una foto nueva de tu menú para crear o actualizar tu tienda en BarrioAI.",
};

export default function SubirPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Actualiza tu menú
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">
          ¿Cambiaron tus precios? Sube una foto nueva y actualizamos tu tienda.
        </p>
      </div>
      <MenuUploadForm />
    </div>
  );
}
