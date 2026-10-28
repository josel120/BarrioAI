"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <h1>Algo salió mal</h1>
        <p>No pudimos cargar BarrioAI. Revisa tu conexión e intenta de nuevo.</p>
        <button type="button" onClick={() => retry()}>Reintentar</button>
      </body>
    </html>
  );
}
