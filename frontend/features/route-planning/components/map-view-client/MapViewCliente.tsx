"use client";
import { useEffect, useRef } from "react";
import type {
  DivIcon,
  LayerGroup,
  Map as MapaLeaflet,
  Marker,
  Polyline,
} from "leaflet";
import { puntoMedioEnLinea, type LimitesMapa, type MapViewModel, type TramoVisible } from "../map-view/mapViewModel";

/**
 * Cliente Leaflet real (solo se importa con ssr:false desde MapView).
 * El mapa se crea UNA vez; cada modelo nuevo actualiza las capas sin
 * recrear el mapa (la animación del vehículo no parpadea).
 * Recibe solo el view-model puro, nunca entidades del backend.
 */
/** Punto de contenedor de levante para la capa opcional del mapa. */
export interface PuntoContenedor {
  lon: number;
  lat: number;
  days?: number;
}

export function MapViewCliente({ modelo, onLimitesChange, tramoSeleccionadoId, onSeleccionarTramo, contenedores, mostrarContenedores, fijarInicioActivo, onFijarInicio }: {
  modelo: MapViewModel;
  onLimitesChange?: (limites: LimitesMapa) => void;
  tramoSeleccionadoId?: string | null;
  onSeleccionarTramo?: (segmentId: string) => void;
  contenedores?: PuntoContenedor[];
  mostrarContenedores?: boolean;
  fijarInicioActivo?: boolean;
  onFijarInicio?: (nodo: { nodeId: string; lat: number; lon: number }) => void;
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
  const refModelo = useRef(modelo);
  const refLimitesChange = useRef(onLimitesChange);
  const refSeleccionado = useRef(tramoSeleccionadoId);
  const refOnSeleccionar = useRef(onSeleccionarTramo);
  const refSeleccionCapas = useRef<Map<string, Polyline>>(new Map());
  const refContenedores = useRef<LayerGroup | null>(null);
  const refContenedoresProps = useRef({ contenedores, mostrarContenedores });
  const refFijarInicio = useRef({ fijarInicioActivo, onFijarInicio });

  useEffect(() => {
    refModelo.current = modelo;
    refLimitesChange.current = onLimitesChange;
    refSeleccionado.current = tramoSeleccionadoId;
    refOnSeleccionar.current = onSeleccionarTramo;
    refContenedoresProps.current = { contenedores, mostrarContenedores };
    refFijarInicio.current = { fijarInicioActivo, onFijarInicio };
  });

  function dibujar(m: MapViewModel) {
    const L = refL.current;
    const mapa = refMapa.current;
    const capas = refCapas.current;
    if (!L || !mapa || !capas) return;

    const clave = `${m.tramos.map((t) => t.segmentId).join(",")}|${m.nodos
      .map((n) => n.nodeId)
      .join(",")}|${m.centro.join(",")}`;

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

      // Contornos de repetición debajo; tramos encima.
      for (const t of m.tramos) {
        if (t.puntos.length === 0) continue;
        if (t.esRepetido) {
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
        const linea = L.polyline(t.puntos, estilo(t, m.hayRecorrido, seleccionado)).bindTooltip(
          etiquetaTramo(t),
        );
        linea.on("click", (evento) => {
          // Evita que el mapa interprete el clic como pan/zoom incidental.
          L.DomEvent.stopPropagation(evento);
          refOnSeleccionar.current?.(t.segmentId);
        });
        linea.addTo(capas);
        refLineas.current.set(t.segmentId, linea);
      }

      for (const n of m.nodos.filter((n) => n.esInicio)) {
        const icono: DivIcon = L.divIcon({
          className: n.esInicio ? "marcador-nodo marcador-nodo-inicio" : "marcador-nodo",
          html: `<span>INICIO ${n.nodeId.replace(/^N0*/, "N")}</span>`,
          iconSize: [84, 32],
          iconAnchor: [42, 16],
        });
        L.marker([n.lat, n.lon], {
          icon: icono,
          keyboard: false,
          title: `INICIO ${n.nodeId}: el circuito empieza y termina acá`,
        }).addTo(refNodos.current);
      }

      // La lista de tramos cambia al mover el mapa por el culling de viewport.
      // Encuadrar solo una vez evita deshacer cada zoom o desplazamiento.
      if (!refEncuadreInicial.current && (m.tramos.length > 0 || m.nodos.length > 1000)) {
        if (m.nodos.length > 1000 || m.tramos.length > 1000) {
          mapa.setView([-34.905, -56.16], 13);
        } else {
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
        const cambioEstilo = !anterior || refHayRecorrido.current !== m.hayRecorrido ||
          anterior.prioridad !== t.prioridad || anterior.esPasoActual !== t.esPasoActual ||
          anterior.esDestino !== t.esDestino || anterior.esTransito !== t.esTransito ||
          anterior.enRecorrido !== t.enRecorrido || anterior.esRepetido !== t.esRepetido;
        linea?.setStyle(estilo(t, m.hayRecorrido, seleccionado));
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
        if (t.esRepetido && !contorno && t.puntos.length > 0) {
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
        if (contorno && cambioEstilo) {
          contorno.setStyle({
            opacity: t.esRepetido ? (t.esPasoActual ? 0.55 : 0.35) : 0,
          });
        }
      }
      // Un solo marcador evita miles de elementos DOM y sigue al inicio elegido.
      refNodos.current?.clearLayers();
      const inicio = m.nodos.find((n) => n.esInicio);
      if (inicio && refNodos.current) {
        const icono = L.divIcon({
          className: "marcador-nodo marcador-nodo-inicio",
          html: `<span>INICIO ${inicio.nodeId.replace(/^N0*/, "N")}</span>`,
          iconSize: [84, 32], iconAnchor: [42, 16],
        });
        L.marker([inicio.lat, inicio.lon], { icon: icono, keyboard: false, title: `INICIO ${inicio.nodeId}: el circuito empieza y termina acá` }).addTo(refNodos.current);
      }
    }
    refDatos.current = new Map(m.tramos.map((t) => [t.segmentId, t]));
    refHayRecorrido.current = m.hayRecorrido;
    actualizarVehiculo(m);
  }

  function actualizarVehiculo(m: MapViewModel) {
    const L = refL.current;
    const mapa = refMapa.current;
    if (!L || !mapa) return;
    const actual = m.tramos.find((t) => t.esPasoActual);
    const puntos = actual?.puntosOrientados ?? actual?.puntos;
    if (!actual || !puntos || puntos.length < 2) {
      refVehiculo.current?.remove();
      refVehiculo.current = null;
      refFlecha.current?.remove();
      refFlecha.current = null;
      return;
    }
    const posicion = puntoMedioEnLinea(puntos);
    if (!posicion) return;
    const { punto: medio, angulo } = posicion;

    if (!refVehiculo.current) {
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

    const iconoFlecha: DivIcon = L.divIcon({
      className: "marcador-flecha",
      html: `<span style="display:inline-block;transform:rotate(${angulo}deg)">➤</span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    if (!refFlecha.current) {
      refFlecha.current = L.marker(medio, {
        icon: iconoFlecha,
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(mapa);
    } else {
      refFlecha.current.setLatLng(medio);
      refFlecha.current.setIcon(iconoFlecha);
    }
  }

  /** Capa opcional de contenedores: se redibuja desde los props vigentes. */
  function dibujarContenedores() {
    const L = refL.current;
    const mapa = refMapa.current;
    if (!L || !mapa) return;
    const { contenedores, mostrarContenedores } = refContenedoresProps.current;
    refContenedores.current?.remove();
    refContenedores.current = null;
    if (!mostrarContenedores || !contenedores || contenedores.length === 0) return;
    const grupo = L.layerGroup();
    for (const p of contenedores.slice(0, 2000)) {
      L.circleMarker([p.lat, p.lon], {
        radius: 3,
        color: "#0ea5e9",
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.7,
        interactive: true,
      })
        .bindTooltip(
          `Contenedor${p.days !== undefined ? ` · ${p.days} días sin recolección` : ""}`,
        )
        .addTo(grupo);
    }
    grupo.addTo(mapa);
    refContenedores.current = grupo;
  }

  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    let reintento: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !refDiv.current || refMapa.current) return;
      refL.current = L;
      mapa = L.map(refDiv.current, { preferCanvas: true }).setView(refModelo.current.centro, 15);
      mapa.on("moveend", () => {
        const bounds = mapa?.getBounds();
        if (bounds) refLimitesChange.current?.({
          sur: bounds.getSouth(), norte: bounds.getNorth(),
          oeste: bounds.getWest(), este: bounds.getEast(),
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dibujar(modelo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo, tramoSeleccionadoId]);

  useEffect(() => {
    dibujarContenedores();
  }, [contenedores, mostrarContenedores, modelo]);

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

function estilo(t: TramoVisible, hayRecorrido: boolean, seleccionado = false) {
  const fueraDeRuta = hayRecorrido && !t.enRecorrido;
  return {
    color: seleccionado && !t.esPasoActual ? "#7c3aed" : colorTramo(t),
    weight: seleccionado ? 10 : t.esPasoActual ? 9 : t.esRepetido ? 7 : t.esDestino ? 6 : 4,
    dashArray: t.esTransito
      ? "3 8"
      : t.prioridad === "medium"
        ? "10 6"
        : t.prioridad === "low"
          ? "2 7"
          : undefined,
    opacity: t.esPasoActual ? 1 : fueraDeRuta ? 0.25 : t.esRepetido ? 0.95 : 0.85,
    className: "cursor-pointer",
  };
}

function colorTramo(t: TramoVisible): string {
  if (t.esPasoActual) return "#047857";
  if (t.esTransito) return "#52525b";
  if (t.prioridad === "high") return "#dc2626";
  if (t.prioridad === "medium") return "#d97706";
  if (t.prioridad === "low") return "#2563eb";
  return "#a1a1aa";
}

function etiquetaTramo(t: TramoVisible): string {
  const paso = t.esDestino
    ? "Destino obligatorio"
    : t.esTransito
      ? "Conexión de tránsito"
      : "Tramo";
  const orden =
    t.ordenes.length > 0 ? ` · pasos ${t.ordenes.map((n) => n + 1).join(", ")}` : "";
  const repeticiones = t.esRepetido ? ` · repetido ×${t.repeticiones}` : "";
  return `${paso}: ${t.segmentId}${orden}${repeticiones}`;
}
