"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatPrecio } from "@/lib/formatPrecio";
import { buildPedidoMessage, buildWhatsAppUrl } from "@/lib/formatWhatsApp";

interface Prod { id: string; nombre: string; precio: number | null; moneda: string; categoria: string; descripcion: string | null }
interface Tienda { id: string; nombre: string; telefono: string | null; direccion: string | null; foto_menu_url: string | null }

export default function TiendaPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ tienda: Tienda; productos: Prod[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/tiendas/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "No pudimos cargar la tienda.");
        return j;
      })
      .then((j) => { if (vivo) setData(j); })
      .catch((e: Error) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [id]);

  if (error)
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>
        <Link href="/buscar" className="inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">Volver a buscar</Link>
      </div>
    );
  if (!data) return <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">Cargando tienda…</p>;

  const { tienda, productos } = data;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/buscar" className="inline-flex min-h-11 items-center text-sm font-semibold text-mercado-800 dark:text-mercado-300">← Volver a buscar</Link>
      <h1 className="text-2xl font-extrabold tracking-tight">{tienda.nombre}</h1>
      {tienda.direccion && <p className="text-sm text-zinc-600 dark:text-zinc-300">{tienda.direccion}</p>}
      {productos.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Esta tienda aún no muestra productos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {productos.map((p) => {
            const wa = buildWhatsAppUrl(tienda.telefono, buildPedidoMessage(p.nombre, tienda.nombre));
            return (
              <li key={p.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-initial truncate font-semibold">{p.nombre}</span>
                  <span aria-hidden="true" className="mx-1 min-w-6 flex-1 border-b-2 border-dotted border-zinc-300 dark:border-zinc-700" />
                  <span className="shrink-0 font-bold tabular-nums text-mercado-700 dark:text-mercado-500">{p.precio != null ? formatPrecio(p.precio, p.moneda) : "Sin precio"}</span>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-300">{p.categoria}{p.descripcion ? ` · ${p.descripcion}` : ""}</span>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center self-start rounded-full bg-mercado-700 px-4 py-2 text-sm font-semibold text-white">Pedir por WhatsApp</a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!tienda.telefono && <p className="text-sm text-zinc-500">Esta tienda aún no registra WhatsApp.</p>}
    </div>
  );
}
