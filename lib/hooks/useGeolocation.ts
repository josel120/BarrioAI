"use client";
import { useState, useEffect } from "react";

export function useGeolocation() {
  // Initial state must be identical on server and client (no `navigator`
  // sniffing here): anything else is a hydration mismatch, and React
  // discards the SSR tree and re-renders from scratch on the client.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot browser
       API read on mount (empty deps, no state read): cannot cascade. */
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Activa tu ubicación para ver tiendas cercanas"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return { coords, error };
}
