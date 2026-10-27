"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Sin feedback visual: la respuesta se percibe inmediata. */
export const SPINNER_DELAY_MS = 1000;
/** A partir de aquí la espera ya no se cubre solo con un spinner. */
export const PROGRESS_DELAY_MS = 4000;

export type LoadingPhase = "none" | "spinner" | "progress";

export function loadingPhase(elapsedMs: number): LoadingPhase {
  if (elapsedMs < SPINNER_DELAY_MS) return "none";
  if (elapsedMs < PROGRESS_DELAY_MS) return "spinner";
  return "progress";
}

/**
 * Progreso estimado para esperas sin avance real (fetch/IA).
 * Crece rápido al inicio y se frena: nunca marca 100 % mientras
 * la tarea sigue activa; se reserva el 95 % como techo.
 */
export function estimatedProgress(
  elapsedMs: number,
  expectedMs = 10000,
): number {
  if (elapsedMs <= 0) return 0;
  const raw = 100 * (1 - Math.exp(-elapsedMs / (expectedMs * 0.6)));
  return Math.min(95, Math.max(1, Math.round(raw)));
}

export function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-8 w-8 animate-spin text-mercado-700 dark:text-mercado-500"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      
    </svg>
  );
}

function ProgressCircle({ progress }: { progress: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled = (progress / 100) * circumference;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="stroke-mercado-700 transition-[stroke-dasharray] duration-200 dark:stroke-mercado-500"
        />
      </svg>
      <p className="absolute inset-0 flex items-center justify-center text-xl font-extrabold tabular-nums">
        {progress}%
      </p>
    </div>
  );
}

/**
 * Feedback de carga según duración (regla del audio):
 * - < 1 s: nada, se percibe inmediato.
 * - 1–4 s: spinner, la espera se siente tolerable.
 * - > 4 s: círculo con % de avance y cuánto falta; al terminar
 *   muestra 100 % un instante y luego pasa a la pantalla.
 *
 * `expectedMs` calibra la estimación (búsqueda ~8 s, subida ~20 s).
 * Se queda montado con `active={false}` al terminar para poder
 * mostrar el 100 % antes de desaparecer.
 */
export function TimedLoading({
  active,
  label,
  expectedMs = 10000,
  children,
}: {
  active: boolean;
  label: string;
  expectedMs?: number;
  children?: ReactNode;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const elapsedRef = useRef(0);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!active) {
      // Solo hay "100 % y pasa a la pantalla" si se llegó a progreso.
      if (wasActiveRef.current && elapsedRef.current >= PROGRESS_DELAY_MS) {
        const show = setTimeout(() => setDone(true), 0);
        const hide = setTimeout(() => {
          setDone(false);
          elapsedRef.current = 0;
          setElapsed(0);
        }, 500);
        wasActiveRef.current = false;
        return () => {
          clearTimeout(show);
          clearTimeout(hide);
        };
      }
      wasActiveRef.current = false;
      elapsedRef.current = 0;
      const reset = setTimeout(() => setElapsed(0), 0);
      return () => clearTimeout(reset);
    }
    wasActiveRef.current = true;
    const start = Date.now();
    elapsedRef.current = 0;
    const reset = setTimeout(() => {
      setElapsed(0);
      setDone(false);
    }, 0);
    const timer = setInterval(() => {
      elapsedRef.current = Date.now() - start;
      setElapsed(elapsedRef.current);
    }, 100);
    return () => {
      clearTimeout(reset);
      clearInterval(timer);
    };
  }, [active]);

  if (done) {
    return (
      <div
        role="status"
        aria-label={`${label}… 100%`}
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <ProgressCircle progress={100} />
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {label}… <span className="font-bold tabular-nums">100%</span>
        </p>
        <p className="text-sm tabular-nums text-zinc-500">Falta 0%</p>
      </div>
    );
  }

  if (!active) return null;

  const phase = loadingPhase(elapsed);
  if (phase === "none") return null;

  const text = `${label}…`;

  if (phase === "spinner") {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          aria-label={text}
          className="flex items-center gap-3 py-2"
        >
          <Spinner />
          <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
            {text}
          </p>
        </div>
        {children}
      </div>
    );
  }

  const progress = estimatedProgress(elapsed, expectedMs);
  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        aria-label={`${text} ${progress}%`}
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <div
          role="progressbar"
          aria-label={text}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${progress}%, falta ${100 - progress}%`}
        >
          <ProgressCircle progress={progress} />
        </div>
        <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
          {text}{" "}
          <span className="font-bold tabular-nums">{progress}%</span>
        </p>
        <p className="text-sm tabular-nums text-zinc-500">
          Falta {100 - progress}%
        </p>
        <div
          aria-hidden="true"
          className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            className="h-full rounded-full bg-mercado-700 transition-[width] duration-200 dark:bg-mercado-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
