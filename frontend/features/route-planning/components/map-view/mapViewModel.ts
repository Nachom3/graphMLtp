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
