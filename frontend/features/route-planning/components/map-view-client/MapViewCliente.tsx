"use client";
import { useEffect, useRef } from "react";
import type { MapViewModel } from "../map-view/mapViewModel";

/**
 * Cliente Leaflet real (solo se importa con ssr:false desde MapView).
 * Importa `leaflet` en efecto para no acoplar el bundle SSR.
 * Recibe solo el view-model puro, nunca entidades del backend.
 */
export function MapViewCliente({ modelo }: { modelo: MapViewModel }) {
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
        if (t.puntos.length === 0) continue;
        const transit = t.esTransito;
        const color = transit
          ? "#52525b"
          : t.prioridad === "high"
            ? "#dc2626"
            : t.prioridad === "medium"
              ? "#d97706"
              : t.prioridad === "low"
                ? "#2563eb"
                : "#a1a1aa";
        const paso = t.esDestino ? "Destino obligatorio" : transit ? "Conexión de tránsito" : "Tramo";
        const orden = t.ordenes.length > 0 ? ` · pasos ${t.ordenes.map((n) => n + 1).join(", ")}` : "";
        const repeticiones = t.repeticiones > 1 ? ` · ${t.repeticiones} recorridos` : "";
        L.polyline(t.puntos, {
          color,
          weight: t.esPasoActual ? 8 : t.esDestino ? 6 : 4,
          dashArray: transit ? "3 8" : t.prioridad === "medium" ? "10 6" : t.prioridad === "low" ? "2 7" : undefined,
          opacity: t.esPasoActual ? 1 : 0.8,
        })
          .bindTooltip(`${paso}: ${t.segmentId}${orden}${repeticiones}`)
          .addTo(mapa);
      }
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [modelo]);
  return <div ref={ref} style={{ height: 400, width: "100%" }} data-testid="map-view" />;
}
