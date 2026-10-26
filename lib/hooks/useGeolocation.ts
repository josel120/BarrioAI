"use client";
import { useState, useEffect } from "react";

export function useGeolocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(() => (typeof navigator !== "undefined" && "geolocation" in navigator ? null : "Tu navegador no soporta GPS"));

  useEffect(() => {
    if (!("geolocation" in navigator))
      return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Activa tu ubicación para ver tiendas cercanas"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { coords, error };
}
