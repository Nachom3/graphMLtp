import type { ApiGateway } from "../application/usecases";
import type {
  ErrorCode,
  ModelComparison,
  ModelId,
  Node,
  OperationError,
  PriorityForSegment,
  PlanInput,
  RouteCost,
  RouteStep,
  Segment,
  TrainingRow,
} from "../domain/types";

/** Formas del backend (nombres del dominio Python; rutas provisorias). */
interface PredictDTO {
  model_id: string;
  predictions: { segment_id: string; priority: "low" | "medium" | "high" }[];
}

interface PlanDTO {
  order: string[];
  repetitions: string[];
  total_cost_m: number;
  unit: string;
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

function trainingRow(r: TrainingRow) {
  return {
    zone_type: r.zoneType,
    container_count: r.containerCount,
    days_since_last_collection: r.daysSinceLastCollection,
    historic_neighbor_complaints: r.historicNeighborComplaints,
    priority: r.priority,
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
      res = await fetch(`${baseUrl}${path}`, { signal });
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
    async predictPriorities(
      modelId: ModelId,
      segments: Segment[],
      signal?: AbortSignal,
      trainingRows: TrainingRow[] = [],
    ): Promise<PriorityForSegment[]> {
      const dto = await post<PredictDTO>(
        "/predictions:predict",
        {
          model_id: modelId,
          // El backend la exige para `arbol`/`logistica` (422 sin ella);
          // `rule-v1` la ignora y acepta `[]`.
          training_rows: trainingRows.map(trainingRow),
          segments: segments.map(segmentRow),
        },
        signal,
      );
      // Asociación inequívoca por segment_id, tal cual la devuelve el backend.
      return dto.predictions.map((p) => ({ segmentId: p.segment_id, priority: p.priority }));
    },
    async planRoute(
      input: PlanInput,
      signal?: AbortSignal,
    ): Promise<{ steps: RouteStep[]; cost: RouteCost }> {
      const dto = await post<PlanDTO>(
        "/routes:plan",
        {
          nodes: input.nodes.map(nodeRow),
          segments: input.segments.map(segmentRow),
          priorities: input.priorities,
          include: input.include,
        },
        signal,
      );
      // Se conserva orden y repeticiones tal cual; el costo es opaco.
      const repeated = new Set(dto.repetitions);
      return {
        steps: dto.order.map((segmentId, order) => ({
          order,
          segmentId,
          repeated: repeated.has(segmentId),
        })),
        cost: { totalCostM: dto.total_cost_m, unit: dto.unit },
      };
    },
  };
}

/** Re-export para documentar la comparación versionada (no pasa por HTTP). */
export type { ModelComparison };
