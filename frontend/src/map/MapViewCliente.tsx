"use client";
import { useEffect, useRef } from "react";
import type { MapViewModel } from "./mapViewModel";

/**
 * Cliente Leaflet real (solo se importa con ssr:false desde MapView).
 * Importa `leaflet` en efecto para no acoplar el bundle SSR.
 * Recibe solo el view-model puro, nunca entidades del backend.
 */
export default function MapViewCliente({ modelo }: { modelo: MapViewModel }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelado = false;
    let mapa: { remove(): void } | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !ref.current) return;
      mapa = L.map(ref.current).setView(modelo.centro, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapa);
      for (const t of modelo.tramos) {
        if (t.puntos.length > 0) L.polyline(t.puntos).addTo(mapa);
      }
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [modelo]);
  return <div ref={ref} style={{ height: 400, width: "100%" }} data-testid="map-view" />;
}
