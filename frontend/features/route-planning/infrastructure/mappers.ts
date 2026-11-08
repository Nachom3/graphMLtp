/**
 * Mapeo DTO↔dominio del adaptador HTTP (sin fetch, sin React).
 *
 * El backend habla inglés (snake_case + GeoJSON lon/lat); el dominio usa
 * camelCase + WGS84 lat/lon. Toda traducción vive acá.
 */
import type {
  ErrorCode,
  Node,
  OperationError,
  Segment,
} from "../domain/types";

/** DTOs del contrato HTTP en inglés; se traducen en este adaptador. */
export interface ScenarioDTO {
  scenario_id?: string;
  version?: string;
  total?: number;
  limit?: number | null;
  truncated?: boolean;
  nodes: { node_id: string; lon: number; lat: number }[];
  segments: {
    segment_id: string;
    origin_node: string;
    destination_node: string;
    length_m: number;
    zone_type: Segment["zoneType"];
    container_count: number;
    days_since_last_collection: number;
    historic_neighbor_complaints: number;
    geometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  }[];
}

export interface PredictDTO {
  model_id: string;
  predictions: { segment_id: string; priority: "low" | "medium" | "high" }[];
}

export interface PlanDTO {
  order: string[];
  repetitions: string[];
  total_cost_m: number;
  unit: string;
  mandatory: string[];
  transit: string[];
  repeated_distance_m: number;
  coverage: number;
}

export interface ExplainDTO {
  segment_id: string;
  priority: "low" | "medium" | "high";
  score: {
    days_weighted: number;
    containers_weighted: number;
    zone_w: number;
    complaints_weighted: number;
    total: number;
  };
  path: {
    node: number;
    leaf?: boolean;
    feature?: string;
    threshold?: number;
    value?: number;
    direction?: string;
  }[];
}

/** Mapea códigos del backend a códigos estables de presentación. */
function mapCode(code: unknown): ErrorCode {
  switch (code) {
    case "IMPOSSIBLE_ROUTE":
      return "impossible-route";
    case "PREDICTION_WITHOUT_SEGMENT":
      return "prediction-without-segment";
    case "INVALID_DATASET":
      return "invalid-dataset";
    default:
      return "backend";
  }
}

/** El backend envuelve errores en {"detail": {"code", "detail"}}. */
export function toOperationError(status: number, body: unknown): OperationError {
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  const code =
    typeof detail === "object" && detail !== null && "code" in detail
      ? (detail as { code: unknown }).code
      : null;
  const message =
    typeof detail === "object" && detail !== null && "detail" in detail
      ? String((detail as { detail: unknown }).detail)
      : JSON.stringify(body);
  if (typeof code === "string") return { code: mapCode(code), detail: message };
  if (status === 404) return { code: "prediction-without-segment", detail: message };
  return { code: "backend", detail: `http ${status}` };
}

export async function read<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw toOperationError(res.status, body);
  }
  return (await res.json()) as T;
}

function geometryFromDTO(geometry: ScenarioDTO["segments"][number]["geometry"]): Segment["geometry"] {
  if (geometry == null) return undefined;
  if (
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 ||
    geometry.coordinates.some((point) =>
      !Array.isArray(point) || point.length !== 2 ||
      !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
      Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90,
    )
  ) throw new Error("Geometría LineString inválida en el escenario");
  return geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

export function scenarioFromDTO(dto: ScenarioDTO) {
  return {
    scenarioId: dto.scenario_id ?? "escenario-api",
    version: dto.version ?? "v1",
    total: dto.total ?? dto.segments.length,
    truncated: dto.truncated ?? false,
    nodes: dto.nodes.map((n) => ({ nodeId: n.node_id, lon: n.lon, lat: n.lat })),
    segments: dto.segments.map((s) => ({
      segmentId: s.segment_id,
      originNode: s.origin_node,
      destinationNode: s.destination_node,
      lengthM: s.length_m,
      zoneType: s.zone_type,
      containerCount: s.container_count,
      daysSinceLastCollection: s.days_since_last_collection,
      historicNeighborComplaints: s.historic_neighbor_complaints,
      geometry: geometryFromDTO(s.geometry),
    })),
  };
}

export function segmentRow(s: Segment) {
  return {
    segment_id: s.segmentId,
    origin_node: s.originNode,
    destination_node: s.destinationNode,
    length_m: s.lengthM,
    zone_type: s.zoneType,
    container_count: s.containerCount,
    days_since_last_collection: s.daysSinceLastCollection,
    historic_neighbor_complaints: s.historicNeighborComplaints,
  };
}

export function nodeRow(n: Node) {
  return { node_id: n.nodeId, lon: n.lon, lat: n.lat };
}
