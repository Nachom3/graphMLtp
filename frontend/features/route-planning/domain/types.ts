/**
 * Tipos y reglas de presentación (puros: sin React, HTTP ni Leaflet).
 *
 * Nombres y valores en inglés del backend (fuente de verdad):
 * SegmentFeatures, Priority low|medium|high, Route(order, repetitions,
 * total_cost_m, unit "meters"), ModelComparison. La copia visible al
 * usuario sigue en español (leyenda, resúmenes, mensajes).
 */

export type Priority = "low" | "medium" | "high";
export type ZoneType = "residential" | "commercial" | "industrial";

/** Identificadores estables (dataset #8): segment_id = reftramo IDE. */
export type SegmentId = string;
export type NodeId = string;

/**
 * Modelos del backend. `rule-v1` es el único default concreto;
 * `arbol`/`logistica` son placeholders hasta que el #10 agregue reales.
 */
export type ModelId = "arbol" | "logistica" | "rule-v1";

export interface Node {
  nodeId: NodeId;
  lon: number; // WGS84 EPSG:4326
  lat: number; // WGS84 EPSG:4326
}

/** Backend: SegmentFeatures (sin calle; el mapa no la usa). */
export interface Segment {
  segmentId: SegmentId;
  originNode: NodeId;
  destinationNode: NodeId;
  lengthM: number; // metros, geodésica (no euclídea en grados)
  zoneType: ZoneType;
  containerCount: number;
  daysSinceLastCollection: number;
  historicNeighborComplaints: number;
}

export interface Scenario {
  scenarioId: string;
  version: string;
  nodes: Node[];
  segments: Segment[];
}

/** Backend: ModelMetrics. */
export interface ModelMetrics {
  modelId: string;
  accuracy: number;
  precisionMacro: number;
  recallMacro: number;
  f1Macro: number;
  confusionMatrix: number[][];
  nTrain: number;
  nTest: number;
}

/** Backend: ModelComparison (resultados ya calculados, offline). */
export interface ModelComparison {
  metrics: ModelMetrics[];
  baselineAccuracy: number;
  bestByCv: string;
  record: Record<string, unknown>;
}

export interface PriorityForSegment {
  segmentId: SegmentId;
  priority: Priority;
}

/** Un paso del recorrido; el mismo tramo puede aparecer varias veces. */
export interface RouteStep {
  order: number; // 0-based, conserva el orden devuelto
  segmentId: SegmentId;
  repeated: boolean; // true si el tramo ya apareció antes
}

/**
 * Costo opaco: lo define el backend (total_cost_m, suma con repeticiones).
 * El frontend nunca lo recalcula.
 */
export interface RouteCost {
  readonly totalCostM: number;
  readonly unit: string; // p. ej. "meters"
}

/** Entrada de planificación (backend: nodes + segments + priorities + include). */
export interface PlanInput {
  nodes: Node[];
  segments: Segment[];
  priorities: Record<SegmentId, Priority>;
  include: Priority[];
}

/** Fila de entrenamiento etiquetada (backend: training rows). */
export interface TrainingRow {
  zoneType: ZoneType;
  containerCount: number;
  daysSinceLastCollection: number;
  historicNeighborComplaints: number;
  priority: Priority;
}

export type ErrorCode =
  | "network"
  | "version-mismatch"
  | "prediction-without-segment"
  | "impossible-route"
  | "invalid-dataset"
  | "backend";

export interface OperationError {
  code: ErrorCode;
  detail?: string;
}

export type OperationState<T> =
  | { estado: "carga"; requestId: number }
  | { estado: "vacio"; motivo: string }
  | { estado: "exito"; requestId: number; datos: T }
  | { estado: "error"; requestId: number; error: OperationError };

/** Marca pasos repetidos sin deduplicar: conserva orden y duplicados. */
export function conRepeticiones(segmentIds: SegmentId[]): RouteStep[] {
  const vistos = new Set<SegmentId>();
  return segmentIds.map((segmentId, i) => {
    const repeated = vistos.has(segmentId);
    vistos.add(segmentId);
    return { order: i, segmentId, repeated };
  });
}

/** Leyenda accesible: etiqueta + patrón, nunca solo color. */
export const LEYENDA_PRIORIDAD: Record<Priority, { etiqueta: string; patron: string }> = {
  high: { etiqueta: "Alta", patron: "línea gruesa sólida" },
  medium: { etiqueta: "Media", patron: "línea media rayada" },
  low: { etiqueta: "Baja", patron: "línea fina punteada" },
};
