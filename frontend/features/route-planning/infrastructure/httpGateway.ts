import type { ApiGateway, RoutePlanInput } from "../application/usecases";
import type {
  ErrorCode,
  ModelComparison,
  ModelId,
  Node,
  OperationError,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Segment,
} from "../domain/types";

/** DTOs del contrato HTTP en inglés; se traducen en este adaptador. */
interface ScenarioDTO {
  scenario_id?: string;
  version?: string;
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

interface PredictDTO {
  model_id: string;
  predictions: { segment_id: string; priority: "low" | "medium" | "high" }[];
}

interface PlanDTO {
  order: string[];
  repetitions: string[];
  total_cost_m: number;
  unit: string;
  mandatory: string[];
  transit: string[];
  repeated_distance_m: number;
  coverage: number;
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
function toOperationError(status: number, body: unknown): OperationError {
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

async function read<T>(res: Response): Promise<T> {
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

function scenarioFromDTO(dto: ScenarioDTO) {
  return {
    scenarioId: dto.scenario_id ?? "escenario-api",
    version: dto.version ?? "v1",
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

function segmentRow(s: Segment) {
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

function nodeRow(n: Node) {
  return { node_id: n.nodeId, lon: n.lon, lat: n.lat };
}

/** Adaptador HTTP: único lugar con fetch. Transforma DTOs y errores del backend. */
export function crearHttpGateway(baseUrl: string): ApiGateway {
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      // El escenario se consulta por petición también desde Server Components;
      // nunca reutilizar una respuesta antigua cuando cambia el dataset.
      res = await fetch(`${baseUrl}${path}`, { signal, cache: "no-store" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw { code: "network" } satisfies OperationError;
    }
    return read<T>(res);
  }
  async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw { code: "network" } satisfies OperationError;
    }
    return read<T>(res);
  }
  return {
    health(signal?: AbortSignal) {
      return get<{ status: string; version: string; schema: string }>("/health", signal);
    },
    async getScenario(signal?: AbortSignal) {
      // Una API caída o un escenario inválido no deben simular datos reales.
      return scenarioFromDTO(await get<ScenarioDTO>("/scenario", signal));
    },
    async predictPriorities(
      modelId: ModelId,
      segments: Segment[],
      signal?: AbortSignal,
    ): Promise<PriorityForSegment[]> {
      const dto = await post<PredictDTO>(
        "/predictions:predict",
        {
          model_id: modelId,
          segments: segments.map(segmentRow),
        },
        signal,
      );
      // Asociación inequívoca por segment_id, tal cual la devuelve el backend.
      return dto.predictions.map((p) => ({ segmentId: p.segment_id, priority: p.priority }));
    },
    async planRoute(
      input: RoutePlanInput,
      signal?: AbortSignal,
    ): Promise<{ steps: RouteStep[]; cost: RouteCost }> {
      const dto = await post<PlanDTO>(
        "/routes:plan",
        {
          nodes: input.nodes.map(nodeRow),
          segments: input.segments.map(segmentRow),
          priorities: input.priorities,
          include: input.include,
          start_node_id: input.startNodeId,
        },
        signal,
      );
      // Conserva el orden y la lista de ids repetidos declarados por el backend.
      const repeatedIds = new Set(dto.repetitions);
      const seen = new Set<string>();
      const steps = dto.order.map((segmentId, order) => {
        const repeated = repeatedIds.has(segmentId) && seen.has(segmentId);
        seen.add(segmentId);
        return { order, segmentId, repeated };
      });
      return {
        steps,
        cost: {
          totalCostM: dto.total_cost_m,
          unit: dto.unit,
          mandatory: dto.mandatory,
          transit: dto.transit,
          repeatedDistanceM: dto.repeated_distance_m,
          coverage: dto.coverage,
        },
      };
    },
  };
}

/** Re-export para documentar la comparación versionada (no pasa por HTTP). */
export type { ModelComparison };
