"use client";
import { useEffect, useRef } from "react";
import type {
  DivIcon,
  LayerGroup,
  Map as MapaLeaflet,
  Marker,
  Polyline,
} from "leaflet";
import type { LimitesMapa, MapViewModel, TramoVisible } from "../map-view/mapViewModel";
import { estilo, etiquetaTramo, mostrarHaloRepeticion, mostrarVehiculo, type ModoMapa } from "./mapStyles";
import { actualizarVehiculo, dibujarContenedores } from "./overlays";
import type { PuntoContenedor } from "./overlays";

export type { PuntoContenedor };

/**
 * Cliente Leaflet real (solo se importa con ssr:false desde MapView).
 * El mapa se crea UNA vez; cada modelo nuevo actualiza las capas sin
 * recrear el mapa (la animación del vehículo no parpadea).
 * Recibe solo el view-model puro, nunca entidades del backend.
 */
export function MapViewCliente({
  modelo,
  onLimitesChange,
  tramoSeleccionadoId,
  onSeleccionarTramo,
  contenedores,
  mostrarContenedores,
  fijarInicioActivo,
  onFijarInicio,
  modoMapa = "prioridad",
  encuadreInicial,
}: {
  modelo: MapViewModel;
  onLimitesChange?: (limites: LimitesMapa) => void;
  tramoSeleccionadoId?: string | null;
  onSeleccionarTramo?: (segmentId: string) => void;
  contenedores?: PuntoContenedor[];
  mostrarContenedores?: boolean;
  fijarInicioActivo?: boolean;
  onFijarInicio?: (nodo: { nodeId: string; lat: number; lon: number }) => void;
  modoMapa?: ModoMapa;
  encuadreInicial?: LimitesMapa | null;
}) {
  const refDiv = useRef<HTMLDivElement | null>(null);
  const refL = useRef<typeof import("leaflet") | null>(null);
  const refMapa = useRef<MapaLeaflet | null>(null);
  const refCapas = useRef<LayerGroup | null>(null);
  const refLineas = useRef<Map<string, Polyline>>(new Map());
  const refContornos = useRef<Map<string, Polyline>>(new Map());
  const refNodos = useRef<LayerGroup | null>(null);
  const refVehiculo = useRef<Marker | null>(null);
  const refFlecha = useRef<Marker | null>(null);
  const refAjuste = useRef<string | null>(null);
  const refEncuadreInicial = useRef(false);
  const refDatos = useRef<Map<string, TramoVisible>>(new Map());
  const refHayRecorrido = useRef(false);
  const refModo = useRef<ModoMapa>(modoMapa);
  const refModelo = useRef(modelo);
  const refLimitesChange = useRef(onLimitesChange);
  const refSeleccionado = useRef(tramoSeleccionadoId);
  const refOnSeleccionar = useRef(onSeleccionarTramo);
  const refSeleccionCapas = useRef<Map<string, Polyline>>(new Map());
  const refContenedores = useRef<LayerGroup | null>(null);
  const refFijarInicio = useRef({ fijarInicioActivo, onFijarInicio });
  const refEncuadre = useRef(encuadreInicial);

  useEffect(() => {
    refModelo.current = modelo;
    refLimitesChange.current = onLimitesChange;
    refSeleccionado.current = tramoSeleccionadoId;
    refOnSeleccionar.current = onSeleccionarTramo;
    refFijarInicio.current = { fijarInicioActivo, onFijarInicio };
    refModo.current = modoMapa;
    refEncuadre.current = encuadreInicial;
  });

  function emitirLimites(mapa: MapaLeaflet) {
    const bounds = mapa.getBounds();
    refLimitesChange.current?.({
      sur: bounds.getSouth(),
      norte: bounds.getNorth(),
      oeste: bounds.getWest(),
      este: bounds.getEast(),
    });
  }

  function dibujar(m: MapViewModel) {
    const L = refL.current;
    const mapa = refMapa.current;
    const capas = refCapas.current;
    if (!L || !mapa || !capas) return;
    const modo = refModo.current;

    const clave = `${m.tramos.map((t) => t.segmentId).join(",")}|${m.nodos
      .map((n) => n.nodeId)
      .join(",")}|${m.centro.join(",")}|${modo}`;

    if (clave !== refAjuste.current) {
      capas.clearLayers();
      refLineas.current = new Map();
      refContornos.current = new Map();
      refSeleccionCapas.current = new Map();
      if (refNodos.current) {
        refNodos.current.clearLayers();
      } else {
        refNodos.current = L.layerGroup().addTo(mapa);
      }

      for (const t of m.tramos) {
        if (t.puntos.length === 0) continue;
        if (mostrarHaloRepeticion(modo, t)) {
          const contorno = L.polyline(t.puntos, {
            color: "#0f766e",
            weight: 12,
            opacity: 0.35,
            lineCap: "round",
            interactive: false,
          });
          contorno.addTo(capas);
          refContornos.current.set(t.segmentId, contorno);
        }
        const seleccionado = refSeleccionado.current === t.segmentId;
        if (seleccionado) {
          const marca = L.polyline(t.puntos, {
            color: "#7c3aed",
            weight: 14,
            opacity: 0.35,
            lineCap: "round",
            interactive: false,
          });
          marca.addTo(capas);
          refSeleccionCapas.current.set(t.segmentId, marca);
        }
        const linea = L.polyline(t.puntos, estilo(t, m.hayRecorrido, seleccionado, modo)).bindTooltip(
          etiquetaTramo(t),
        );
        linea.on("click", (evento) => {
          L.DomEvent.stopPropagation(evento);
          refOnSeleccionar.current?.(t.segmentId);
        });
        linea.addTo(capas);
        refLineas.current.set(t.segmentId, linea);
      }

      for (const n of m.nodos.filter((n) => n.esInicio)) {
        const icono: DivIcon = L.divIcon({
          className: "marcador-nodo marcador-nodo-inicio",
          html: `<span>INICIO ${n.nodeId.replace(/^N0*/, "N")}</span>`,
          iconSize: [96, 36],
          iconAnchor: [48, 18],
        });
        L.marker([n.lat, n.lon], {
          icon: icono,
          keyboard: false,
          zIndexOffset: 800,
          title: `INICIO ${n.nodeId}: el circuito empieza y termina acá`,
        }).addTo(refNodos.current!);
      }

      if (!refEncuadreInicial.current) {
        const barrio = refEncuadre.current;
        if (barrio) {
          const box = L.latLngBounds(
            [barrio.sur, barrio.oeste],
            [barrio.norte, barrio.este],
          );
          // fitBounds dispara moveend → onLimitesChange (Leaflet real).
          mapa.fitBounds(box, { padding: [24, 24], maxZoom: 16 });
        } else if (m.nodos.length > 1000 || m.tramos.length > 1000) {
          mapa.setView([-34.905, -56.16], 13);
        } else if (m.tramos.length > 0) {
          const limites = L.latLngBounds([]);
          for (const tramo of m.tramos) {
            for (const punto of tramo.puntos) limites.extend(punto);
          }
          if (limites.isValid()) mapa.fitBounds(limites, { padding: [36, 36] });
        }
        refEncuadreInicial.current = true;
      }
      refAjuste.current = clave;
    } else {
      for (const t of m.tramos) {
        const anterior = refDatos.current.get(t.segmentId);
        const linea = refLineas.current.get(t.segmentId);
        const seleccionado = refSeleccionado.current === t.segmentId;
        linea?.setStyle(estilo(t, m.hayRecorrido, seleccionado, modo));
        let marca = refSeleccionCapas.current.get(t.segmentId);
        if (seleccionado && !marca && t.puntos.length > 0) {
          marca = L.polyline(t.puntos, {
            color: "#7c3aed",
            weight: 14,
            opacity: 0.35,
            lineCap: "round",
            interactive: false,
          });
          marca.addTo(capas);
          marca.bringToBack();
          refSeleccionCapas.current.set(t.segmentId, marca);
        }
        if (marca && !seleccionado) {
          marca.remove();
          refSeleccionCapas.current.delete(t.segmentId);
        }
        if (!anterior || anterior.esDestino !== t.esDestino || anterior.esTransito !== t.esTransito ||
          anterior.repeticiones !== t.repeticiones || anterior.ordenes.join(",") !== t.ordenes.join(",")) {
          linea?.setTooltipContent(etiquetaTramo(t));
        }
        const contorno = refContornos.current.get(t.segmentId);
        if (mostrarHaloRepeticion(modo, t) && !contorno && t.puntos.length > 0) {
          const nuevo = L.polyline(t.puntos, {
            color: "#0f766e",
            weight: 12,
            opacity: 0.35,
            lineCap: "round",
            interactive: false,
          });
          nuevo.addTo(capas);
          nuevo.bringToBack();
          refContornos.current.set(t.segmentId, nuevo);
        }
        if (contorno) {
          contorno.setStyle({
            opacity: mostrarHaloRepeticion(modo, t) ? (t.esPasoActual ? 0.55 : 0.35) : 0,
          });
        }
      }
      refNodos.current?.clearLayers();
      const inicio = m.nodos.find((n) => n.esInicio);
      if (inicio && refNodos.current) {
        const icono = L.divIcon({
          className: "marcador-nodo marcador-nodo-inicio",
          html: `<span>INICIO ${inicio.nodeId.replace(/^N0*/, "N")}</span>`,
          iconSize: [96, 36],
          iconAnchor: [48, 18],
        });
        L.marker([inicio.lat, inicio.lon], {
          icon: icono,
          keyboard: false,
          zIndexOffset: 800,
          title: `INICIO ${inicio.nodeId}: el circuito empieza y termina acá`,
        }).addTo(refNodos.current);
      }
    }
    refDatos.current = new Map(m.tramos.map((t) => [t.segmentId, t]));
    refHayRecorrido.current = m.hayRecorrido;
    actualizarVehiculo(L, mapa, m, refVehiculo, refFlecha, mostrarVehiculo(modo));
  }

  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    let reintento: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !refDiv.current || refMapa.current) return;
      refL.current = L;
      const barrio = refEncuadre.current;
      const centroInicial: [number, number] = barrio
        ? [(barrio.sur + barrio.norte) / 2, (barrio.oeste + barrio.este) / 2]
        : refModelo.current.centro;
      mapa = L.map(refDiv.current, { preferCanvas: true }).setView(centroInicial, 15);
      mapa.on("moveend", () => {
        if (mapa) emitirLimites(mapa);
      });
      mapa.on("click", (evento: { latlng: { lat: number; lng: number } }) => {
        const { fijarInicioActivo, onFijarInicio } = refFijarInicio.current;
        if (!fijarInicioActivo) return;
        const nodos = refModelo.current.nodos;
        let mejor: { nodeId: string; lat: number; lon: number } | null = null;
        let mejorDist = Infinity;
        for (const n of nodos) {
          const dist = Math.hypot(n.lat - evento.latlng.lat, n.lon - evento.latlng.lng);
          if (dist < mejorDist) {
            mejorDist = dist;
            mejor = { nodeId: n.nodeId, lat: n.lat, lon: n.lon };
          }
        }
        if (mejor) onFijarInicio?.(mejor);
      });
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
        refContornos.current = new Map();
        refSeleccionCapas.current = new Map();
        refContenedores.current = null;
        refNodos.current = null;
        refVehiculo.current = null;
        refFlecha.current = null;
        refAjuste.current = null;
        refEncuadreInicial.current = false;
        refDatos.current = new Map();
      }
    };
  }, []);

  useEffect(() => {
    dibujar(modelo);
  }, [modelo, tramoSeleccionadoId, modoMapa]);

  useEffect(() => {
    const L = refL.current;
    const mapa = refMapa.current;
    if (!L || !mapa) return;
    refContenedores.current = dibujarContenedores(
      L,
      mapa,
      refContenedores.current,
      contenedores,
      mostrarContenedores,
      modoMapa === "contenedores",
    );
  }, [contenedores, mostrarContenedores, modelo, modoMapa]);

  return (
    <div
      ref={refDiv}
      style={{ height: 480, width: "100%" }}
      data-testid="map-view"
      role="img"
      aria-label="Mapa del escenario con el recorrido planificado"
    />
  );
}

export { colorTramo, estilo, etiquetaTramo } from "./mapStyles";
