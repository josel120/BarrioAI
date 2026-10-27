import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SiteHeader, TabBar } from "@/components/site";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BarrioAI — Lo que vende tu barrio",
    template: "%s | BarrioAI",
  },
  description:
    "Busca antojos, bodegas y servicios cerca de ti, o publica tu menú con una foto.",
};

const TEMA_INIT = `(function(){try{if(localStorage.getItem("barrioai-tema")==="meta"){document.documentElement.dataset.theme="meta"}}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: TEMA_INIT }} />
        <a
          href="#contenido"
          className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-mercado-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <div
          id="contenido"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-5"
        >
          {children}
        </div>
        <TabBar />
      </body>
    </html>
  );
}
