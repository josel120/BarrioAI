"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CameraIcon, HomeIcon, SearchIcon } from "./icons";

const TEMA_KEY = "barrioai-tema";

type Tema = "mercado" | "meta";

function subscribeTema(cambio: () => void) {
  const observador = new MutationObserver(cambio);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observador.disconnect();
}

function leerTema(): Tema {
  return document.documentElement.dataset.theme === "meta" ? "meta" : "mercado";
}

function leerTemaServidor(): Tema {
  return "mercado";
}

function ThemeToggle() {
  const tema = useSyncExternalStore(
    subscribeTema,
    leerTema,
    leerTemaServidor,
  );

  function cambiar() {
    const siguiente: Tema = tema === "meta" ? "mercado" : "meta";
    if (siguiente === "meta") {
      document.documentElement.dataset.theme = "meta";
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(TEMA_KEY, siguiente);
    } catch {
      // Sin almacenamiento: el tema solo dura esta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-label={
        tema === "meta" ? "Cambiar a tema Mercado" : "Cambiar a tema Meta"
      }
      className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600"
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full bg-mercado-600"
      />
      {tema === "meta" ? "Meta" : "Mercado"}
    </button>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <Link
          href="/"
          aria-label="BarrioAI" className="inline-flex min-h-11 items-center text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Barrio
          <span className="text-mercado-700 dark:text-mercado-500">AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/vender"
            className="inline-flex min-h-11 items-center rounded-full border border-mercado-700 px-4 py-2 text-sm font-semibold text-mercado-800 transition-colors hover:bg-mercado-50 dark:border-mercado-500 dark:text-mercado-300 dark:hover:bg-mercado-950"
          >
            Vender
          </Link>
        </div>
      </div>
    </header>
  );
}

const TABS = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon },
  { href: "/vender", label: "Vender", Icon: CameraIcon },
] as const;

function isActiveTab(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActiveTab(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "relative flex min-h-11 flex-col items-center gap-0.5 py-2.5 text-xs font-bold text-mercado-700 before:absolute before:inset-x-8 before:top-0 before:h-0.5 before:rounded-full before:bg-mercado-600 dark:text-mercado-500"
                  : "flex min-h-11 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
