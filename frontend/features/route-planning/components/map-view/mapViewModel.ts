import type { Node, Priority, PriorityForSegment, RouteStep, Segment } from "../../domain/types";

/** View-model puro del mapa: sin Leaflet, sin DOM. Testeable en Node. */
export interface TramoVisible {
  segmentId: string;
  puntos: [number, number][]; // [lat, lon] listo para polyline
  /** Orientación del paso actual (origen→destino del recorrido). */
  puntosOrientados?: [number, number][];
  prioridad: Priority | "unknown";
  patron: string;
  esPasoActual: boolean;
  /** Ya lo transitó el camión (pasos anteriores al actual). Queda en verde. */
  yaRecorrido: boolean;
  esDestino: boolean;
  esTransito: boolean;
  /** Aparece al menos una vez en el circuito. */
  enRecorrido: boolean;
  /** Se recorre más de una vez (requisito del enunciado). */
  esRepetido: boolean;
  ordenes: number[]; // orden devuelto por el backend, incluidas repeticiones
  repeticiones: number; // cuántas veces aparece en el recorrido
}

export interface NodoVisible {
  nodeId: string;
  lat: number;
  lon: number;
  esInicio: boolean;
}

export interface MapViewModel {
  centro: [number, number];
  tramos: TramoVisible[];
  nodos: NodoVisible[];
  resumen: string;
  hayRecorrido: boolean;
  /** Tramos dibujados como aproximación recta por falta de geometría vial. */
  tramosSinGeometria: number;
}

/** Límites geográficos del área visible, en grados WGS84. */
export interface LimitesMapa {
  sur: number;
  norte: number;
  oeste: number;
  este: number;
}

/** Prueba la geometría completa, incluidos segmentos que cruzan el rectángulo. */
export function lineaIntersecaLimites(puntos: [number, number][], limites: LimitesMapa): boolean {
  const { sur, norte, oeste, este } = limites;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [lat, lon] = puntos[i];
    const [lat2, lon2] = puntos[i + 1];
    const dx = lon2 - lon;
    const dy = lat2 - lat;
    let entrada = 0;
    let salida = 1;
    const bordes: [number, number][] = [
      [-dx, lon - oeste], [dx, este - lon], [-dy, lat - sur], [dy, norte - lat],
    ];
    for (const [p, q] of bordes) {
      if (p === 0) {
        if (q < 0) { entrada = 1; salida = 0; break; }
      } else if (p < 0) {
        entrada = Math.max(entrada, q / p);
      } else {
        salida = Math.min(salida, q / p);
      }
    }
    if (entrada <= salida) return true;
  }
  return false;
}

const PATRON: Record<string, string> = {
  high: "gruesa sólida",
  medium: "media rayada",
  low: "fina punteada",
  unknown: "fina gris",
};

function puntosDelTramo(
  tramo: Segment,
  nodos: Map<string, { lat: number; lon: number }>,
): [number, number][] {
  if (tramo.geometry && tramo.geometry.length >= 2) return tramo.geometry;
  const a = nodos.get(tramo.originNode);
  const b = nodos.get(tramo.destinationNode);
  return a && b ? [[a.lat, a.lon], [b.lat, b.lon]] : [];
}

/** Los tramos se incluyen completos si su geometría intersecta la vista. */
export function seleccionarAreaVisible(
  nodos: Node[], tramos: Segment[], limites: LimitesMapa,
): { nodos: Node[]; tramos: Segment[] } {
  const porId = new Map(nodos.map((n) => [n.nodeId, n]));
  const incluidos = tramos.filter((t) => lineaIntersecaLimites(puntosDelTramo(t, porId), limites));
  const ids = new Set(incluidos.flatMap((t) => [t.originNode, t.destinationNode]));
  return { nodos: nodos.filter((n) => ids.has(n.nodeId)), tramos: incluidos };
}

/** Punto a mitad de longitud sobre la línea y orientación de su tramo local. */
export function puntoMedioEnLinea(puntos: [number, number][]): {
  punto: [number, number];
  angulo: number;
} | null {
  if (puntos.length < 2) return null;
  const escalaLon = Math.cos((puntos[0][0] * Math.PI) / 180);
  const longitudes = puntos.slice(1).map((p, i) =>
    Math.hypot(p[0] - puntos[i][0], (p[1] - puntos[i][1]) * escalaLon),
  );
  const total = longitudes.reduce((sum, longitud) => sum + longitud, 0);
  if (total === 0) return { punto: puntos[0], angulo: 0 };
  let restante = total / 2;
  for (let i = 0; i < longitudes.length; i++) {
    const longitud = longitudes[i];
    if (longitud === 0) continue;
    if (restante <= longitud) {
      const a = puntos[i];
      const b = puntos[i + 1];
      const proporcion = restante / longitud;
      return {
        punto: [a[0] + (b[0] - a[0]) * proporcion, a[1] + (b[1] - a[1]) * proporcion],
        // Pantalla: +x este y +y sur; la flecha apunta inicialmente a la derecha.
        angulo: (Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * escalaLon) * 180) / Math.PI,
      };
    }
    restante -= longitud;
  }
  return { punto: puntos[puntos.length - 1], angulo: 0 };
}

/**
 * Orienta cada paso del circuito encadenando nodos desde el inicio.
 * El backend entrega aristas no dirigidas; la UI necesita sentido de marcha.
 */
export function orientarPasos(args: {
  pasos: RouteStep[];
  tramos: Segment[];
  nodos: Map<string, { lat: number; lon: number }>;
  startNodeId?: string;
}): Map<number, { from: string; to: string; puntos: [number, number][] }> {
  const byId = new Map(args.tramos.map((t) => [t.segmentId, t]));
  const out = new Map<number, { from: string; to: string; puntos: [number, number][] }>();
  let actual = args.startNodeId ?? "";

  for (const paso of args.pasos) {
    const seg = byId.get(paso.segmentId);
    if (!seg) continue;
    const linea = puntosDelTramo(seg, args.nodos);
    if (linea.length < 2) continue;

    let from = seg.originNode;
    let to = seg.destinationNode;
    let puntos = linea;

    if (actual && actual === seg.destinationNode && actual !== seg.originNode) {
      from = seg.destinationNode;
      to = seg.originNode;
      puntos = [...linea].reverse();
    } else if (actual && actual === seg.originNode) {
      from = seg.originNode;
      to = seg.destinationNode;
    } else if (!actual) {
      // Sin nodo de inicio conocido: conserva el orden del dataset.
      from = seg.originNode;
      to = seg.destinationNode;
    } else {
      // El paso no toca el nodo actual (grafo raro): elige origen del dataset.
      from = seg.originNode;
      to = seg.destinationNode;
      puntos = linea;
    }

    out.set(paso.order, { from, to, puntos });
    actual = to;
  }

  return out;
}

/**
 * Radio (m) para considerar un contenedor dentro del grafo.
 * Igual que SNAP_RADIUS_M del dataset_builder: el builder asigna cada
 * contenedor al tramo más cercano dentro de 25 m; más lejos queda en
 * cuarentena (no-asignado). El mapa solo muestra los asignables al grafo
 * modelado para no confundir con contenedores de otras zonas.
 */
export const RADIO_CONTENEDOR_GRAFO_M = 25;

/** Distancia haversiana punto→segmento proyectado en metros (plano local). */
function distanciaPuntoSegmentoM(
  lat: number,
  lon: number,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const aRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(aRad);
  const toX = (lo: number) => ((lo - lon) * Math.PI) / 180 * R * cosLat;
  const toY = (la: number) => ((la - lat) * Math.PI) / 180 * R;
  const x1 = toX(lon1);
  const y1 = toY(lat1);
  const x2 = toX(lon2);
  const y2 = toY(lat2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(x1 * dx + y1 * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(px, py);
}

/** ¿El punto está a <= radio de la polilínea del tramo? */
function puntoCercaDeLinea(
  lat: number,
  lon: number,
  linea: [number, number][],
  radioM: number,
): boolean {
  for (let i = 0; i < linea.length - 1; i++) {
    const [lat1, lon1] = linea[i];
    const [lat2, lon2] = linea[i + 1];
    // Rechazo rápido por bbox expandida (~grados) antes del cálculo fino.
    const margenLat = radioM / 111320 + 1e-9;
    const cosLat = Math.max(0.2, Math.abs(Math.cos((lat * Math.PI) / 180)));
    const margenLon = radioM / (111320 * cosLat) + 1e-9;
    const minLat = Math.min(lat1, lat2) - margenLat;
    const maxLat = Math.max(lat1, lat2) + margenLat;
    const minLon = Math.min(lon1, lon2) - margenLon;
    const maxLon = Math.max(lon1, lon2) + margenLon;
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) continue;
    if (distanciaPuntoSegmentoM(lat, lon, lat1, lon1, lat2, lon2) <= radioM) return true;
  }
  return false;
}

/**
 * SOLO contenedores dentro del grafo modelado: conserva los puntos a <=
 * radioM de algún tramo del grafo (por geometría real o recta entre nodos).
 * Sin grafo o sin puntos devuelve []. Pura y testeable en Node.
 */
export function filtrarContenedoresEnGrafo<T extends { lat: number; lon: number }>(args: {
  contenedores: T[];
  tramos: Segment[];
  nodos: Map<string, { lat: number; lon: number }>;
  radioM?: number;
}): T[] {
  const { contenedores, tramos, nodos, radioM = RADIO_CONTENEDOR_GRAFO_M } = args;
  if (contenedores.length === 0 || tramos.length === 0) return [];
  // Precalcula líneas una vez: geometría real o recta origen→destino.
  const lineas: [number, number][][] = tramos.map((t) => puntosDelTramo(t, nodos));
  return contenedores.filter((p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
    for (const linea of lineas) {
      if (linea.length < 2) continue;
      if (puntoCercaDeLinea(p.lat, p.lon, linea, radioM)) return true;
    }
    return false;
  });
}

/** Construye el view-model desde tramos + prioridades + recorrido. */
export function toMapViewModel(args: {
  tramos: Segment[];
  nodos: Map<string, { lat: number; lon: number }>;
  prioridades: PriorityForSegment[];
  pasos: RouteStep[];
  mandatory?: string[];
  transit?: string[];
  pasoActual?: number;
  startNodeId?: string;
}): MapViewModel {
  const pri = new Map(args.prioridades.map((p) => [p.segmentId, p.priority]));
  const conteo = new Map<string, number>();
  const ordenes = new Map<string, number[]>();
  for (const p of args.pasos) {
    conteo.set(p.segmentId, (conteo.get(p.segmentId) ?? 0) + 1);
    ordenes.set(p.segmentId, [...(ordenes.get(p.segmentId) ?? []), p.order]);
  }
  const mandatory = new Set(args.mandatory ?? []);
  const transit = new Set(args.transit ?? []);
  const orientados = orientarPasos({
    pasos: args.pasos,
    tramos: args.tramos,
    nodos: args.nodos,
    startNodeId: args.startNodeId,
  });
  const pasoActual = args.pasoActual ?? -1;
  const actualId = args.pasos[pasoActual]?.segmentId;
  const puntosPasoActual = orientados.get(pasoActual)?.puntos;
  const previos = new Set(args.pasos.slice(0, Math.max(pasoActual, 0)).map((p) => p.segmentId));

  const tramos: TramoVisible[] = args.tramos.map((t) => {
    const prioridad = pri.get(t.segmentId) ?? "unknown";
    const puntos = puntosDelTramo(t, args.nodos);
    const repeticiones = conteo.get(t.segmentId) ?? 0;
    const esPasoActual = actualId === t.segmentId;
    return {
      segmentId: t.segmentId,
      puntos,
      puntosOrientados: esPasoActual ? puntosPasoActual : undefined,
      prioridad,
      patron: PATRON[prioridad],
      esPasoActual,
      yaRecorrido: previos.has(t.segmentId),
      esDestino: mandatory.has(t.segmentId),
      esTransito: transit.has(t.segmentId),
      enRecorrido: repeticiones > 0,
      esRepetido: repeticiones > 1,
      ordenes: ordenes.get(t.segmentId) ?? [],
      repeticiones,
    };
  });

  const nodos: NodoVisible[] = [...args.nodos.entries()].map(([nodeId, coords]) => ({
    nodeId,
    lat: coords.lat,
    lon: coords.lon,
    esInicio: args.startNodeId === nodeId,
  }));

  const lats = [...args.nodos.values()].map((n) => n.lat);
  const lons = [...args.nodos.values()].map((n) => n.lon);
  const centro: [number, number] =
    lats.length > 0
      ? [lats.reduce((s, v) => s + v, 0) / lats.length, lons.reduce((s, v) => s + v, 0) / lons.length]
      : [-34.91, -56.155];

  const repetidos = [...conteo.entries()].filter(([, n]) => n > 1);
  const resumen =
    args.pasos.length === 0
      ? "Sin recorrido."
      : `Recorrido de ${args.pasos.length} pasos` +
        (repetidos.length > 0
          ? `, con ${repetidos.length} tramo(s) repetido(s): ` +
            repetidos.map(([id, n]) => `${id}×${n}`).join(", ")
          : ", sin repeticiones.");

  return {
    centro, tramos, nodos, resumen, hayRecorrido: args.pasos.length > 0,
    tramosSinGeometria: args.tramos.filter((t) => !t.geometry || t.geometry.length < 2).length,
  };
}
