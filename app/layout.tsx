import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SiteHeader, TabBar } from "@/components/site";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BarrioAI — Lo que vende tu barrio",
    template: "%s | BarrioAI",
  },
  description:
    "Busca antojos, bodegas y servicios cerca de ti, o publica tu menú con una foto.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15803d" },
    { media: "(prefers-color-scheme: dark)", color: "#052e16" },
  ],
};

const TEMA_INIT = `(function(){try{if(localStorage.getItem("barrioai-tema")==="meta"){document.documentElement.dataset.theme="meta"}}catch(e){}})()`;
const SW_INIT = `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: TEMA_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: SW_INIT }} />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:h-auto focus:w-auto focus:rounded-full focus:bg-mercado-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:whitespace-normal"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5"
        >
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  );
}
