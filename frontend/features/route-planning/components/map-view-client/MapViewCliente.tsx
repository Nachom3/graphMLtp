"use client";
import { useEffect, useRef } from "react";
import type {
  DivIcon,
  LayerGroup,
  Map as MapaLeaflet,
  Marker,
  Polyline,
} from "leaflet";
import type { MapViewModel, TramoVisible } from "../map-view/mapViewModel";

/**
 * Cliente Leaflet real (solo se importa con ssr:false desde MapView).
 * El mapa se crea UNA vez; cada modelo nuevo actualiza las capas sin
 * recrear el mapa (la animación del vehículo no parpadea).
 * Recibe solo el view-model puro, nunca entidades del backend.
 */
export function MapViewCliente({ modelo }: { modelo: MapViewModel }) {
  const refDiv = useRef<HTMLDivElement | null>(null);
  const refL = useRef<typeof import("leaflet") | null>(null);
  const refMapa = useRef<MapaLeaflet | null>(null);
  const refCapas = useRef<LayerGroup | null>(null);
  const refLineas = useRef<Map<string, Polyline>>(new Map());
  const refVehiculo = useRef<Marker | null>(null);
  const refAjuste = useRef<string | null>(null);
  const refModelo = useRef(modelo);

  // El modelo vigente siempre disponible para la carga asíncrona de Leaflet.
  useEffect(() => {
    refModelo.current = modelo;
  });

  function dibujar(m: MapViewModel) {
    const L = refL.current;
    const mapa = refMapa.current;
    const capas = refCapas.current;
    if (!L || !mapa || !capas) return;
    const clave = `${m.tramos.map((t) => t.segmentId).join(",")}|${m.centro.join(",")}`;
    if (clave !== refAjuste.current) {
      capas.clearLayers();
      refLineas.current = new Map();
      for (const t of m.tramos) {
        if (t.puntos.length === 0) continue;
        const linea = L.polyline(t.puntos, estilo(t)).bindTooltip(etiquetaTramo(t));
        linea.addTo(capas);
        refLineas.current.set(t.segmentId, linea);
      }
      const puntos = m.tramos.flatMap((t) => t.puntos);
      if (puntos.length > 0) {
        mapa.fitBounds(L.latLngBounds(puntos.map(([lat, lon]) => L.latLng(lat, lon))), {
          padding: [24, 24],
        });
      }
      refAjuste.current = clave;
    } else {
      // Mismo escenario: solo se actualiza el resaltado del paso actual.
      for (const t of m.tramos) {
        refLineas.current.get(t.segmentId)?.setStyle(estilo(t));
      }
    }
    actualizarVehiculo(m);
  }

  function actualizarVehiculo(m: MapViewModel) {
    const L = refL.current;
    const mapa = refMapa.current;
    if (!L || !mapa) return;
    const actual = m.tramos.find((t) => t.esPasoActual);
    if (!actual || actual.puntos.length === 0) {
      refVehiculo.current?.remove();
      refVehiculo.current = null;
      return;
    }
    const [a, b] = [actual.puntos[0], actual.puntos[actual.puntos.length - 1]];
    const medio: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!refVehiculo.current) {
      // Camión en SVG en línea (estilo lucide), sin depender de fuentes emoji.
      const icono: DivIcon = L.divIcon({
        html: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'/><path d='M15 18H9'/><path d='M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14'/><circle cx='17' cy='18' r='2'/><circle cx='7' cy='18' r='2'/></svg>",
        className: "marcador-vehiculo",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      refVehiculo.current = L.marker(medio, {
        icon: icono,
        title: "Vehículo recolector",
        zIndexOffset: 1000,
        keyboard: false,
      }).addTo(mapa);
    } else {
      refVehiculo.current.setLatLng(medio);
    }
    refVehiculo.current.bindTooltip(`Vehículo recolector: tramo ${actual.segmentId}`);
  }

  // Montaje único del mapa (con limpieza para StrictMode).
  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    let reintento: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !refDiv.current || refMapa.current) return;
      refL.current = L;
      mapa = L.map(refDiv.current).setView(refModelo.current.centro, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);
      refMapa.current = mapa;
      refCapas.current = L.layerGroup().addTo(mapa);
      const vigente = refModelo.current;
      if (vigente) dibujar(vigente);
      reintento = setTimeout(() => mapa?.invalidateSize(), 100);
    })();
    return () => {
      cancelado = true;
      if (reintento) clearTimeout(reintento);
      mapa?.remove();
      if (refMapa.current === mapa) {
        refMapa.current = null;
        refCapas.current = null;
        refLineas.current = new Map();
        refVehiculo.current = null;
        refAjuste.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada modelo nuevo redibuja capas; el mapa persiste.
  useEffect(() => {
    dibujar(modelo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo]);

  return (
    <div
      ref={refDiv}
      style={{ height: 400, width: "100%" }}
      data-testid="map-view"
      role="img"
      aria-label="Mapa del escenario con el recorrido planificado"
    />
  );
}

function estilo(t: TramoVisible) {
  return {
    color: colorTramo(t),
    weight: t.esPasoActual ? 8 : t.esDestino ? 6 : 4,
    dashArray: t.esTransito
      ? "3 8"
      : t.prioridad === "medium"
        ? "10 6"
        : t.prioridad === "low"
          ? "2 7"
          : undefined,
    opacity: t.esPasoActual ? 1 : 0.8,
  };
}

function colorTramo(t: TramoVisible): string {
  if (t.esTransito) return "#52525b";
  if (t.prioridad === "high") return "#dc2626";
  if (t.prioridad === "medium") return "#d97706";
  if (t.prioridad === "low") return "#2563eb";
  return "#a1a1aa";
}

function etiquetaTramo(t: TramoVisible): string {
  const paso = t.esDestino ? "Destino obligatorio" : t.esTransito ? "Conexión de tránsito" : "Tramo";
  const orden = t.ordenes.length > 0 ? ` · pasos ${t.ordenes.map((n) => n + 1).join(", ")}` : "";
  const repeticiones = t.repeticiones > 1 ? ` · ${t.repeticiones} recorridos` : "";
  return `${paso}: ${t.segmentId}${orden}${repeticiones}`;
}
