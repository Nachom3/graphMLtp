import type { Priority, PriorityForSegment, RouteStep, Segment } from "../../domain/types";

/** View-model puro del mapa: sin Leaflet, sin DOM. Testeable en Node. */
export interface TramoVisible {
  segmentId: string;
  puntos: [number, number][]; // [lat, lon] listo para polyline
  prioridad: Priority | "unknown";
  patron: string;
  esPasoActual: boolean;
  esDestino: boolean;
  esTransito: boolean;
  ordenes: number[]; // orden devuelto por el backend, incluidas repeticiones
  repeticiones: number; // cuántas veces aparece en el recorrido
}

export interface MapViewModel {
  centro: [number, number];
  tramos: TramoVisible[];
  resumen: string;
}

const PATRON: Record<string, string> = {
  high: "gruesa sólida",
  medium: "media rayada",
  low: "fina punteada",
  unknown: "fina gris",
};

/** Construye el view-model desde tramos + prioridades + recorrido. */
export function toMapViewModel(args: {
  tramos: Segment[];
  nodos: Map<string, { lat: number; lon: number }>;
  prioridades: PriorityForSegment[];
  pasos: RouteStep[];
  mandatory?: string[];
  transit?: string[];
  pasoActual?: number;
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

  const tramos: TramoVisible[] = args.tramos.map((t) => {
    const prioridad = pri.get(t.segmentId) ?? "unknown";
    const a = args.nodos.get(t.originNode);
    const b = args.nodos.get(t.destinationNode);
    const puntos: [number, number][] =
      a && b
        ? [
            [a.lat, a.lon],
            [b.lat, b.lon],
          ]
        : [];
    const repeticiones = conteo.get(t.segmentId) ?? 0;
    const actual = args.pasos[args.pasoActual ?? -1]?.segmentId === t.segmentId;
    return {
      segmentId: t.segmentId,
      puntos,
      prioridad,
      patron: PATRON[prioridad],
      esPasoActual: actual,
      esDestino: mandatory.has(t.segmentId),
      esTransito: transit.has(t.segmentId),
      ordenes: ordenes.get(t.segmentId) ?? [],
      repeticiones,
    };
  });

  const lats = args.tramos.flatMap((t) => {
    const a = args.nodos.get(t.originNode);
    const b = args.nodos.get(t.destinationNode);
    return [a, b].filter((x) => x !== undefined).map((x) => x.lat);
  });
  const lons = args.tramos.flatMap((t) => {
    const a = args.nodos.get(t.originNode);
    const b = args.nodos.get(t.destinationNode);
    return [a, b].filter((x) => x !== undefined).map((x) => x.lon);
  });
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

  return { centro, tramos, resumen };
}
