"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoCoords } from "@/lib/search/types";

export function useGeolocation({ auto = true }: { auto?: boolean } = {}) {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const autoRan = useRef(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta GPS. Elige tu zona manualmente.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Activa tu ubicación para ver tiendas cercanas, o elige tu zona.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const setManual = useCallback((c: GeoCoords) => {
    setCoords(c);
    setError(null);
  }, []);

  useEffect(() => {
    if (!auto || autoRan.current) return;
    autoRan.current = true;
    const t = setTimeout(request, 0);
    return () => clearTimeout(t);
  }, [auto, request]);

  return { coords, error, locating, request, setManual };
}
