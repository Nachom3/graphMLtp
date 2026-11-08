import type { ApiGateway, OpcionesEscenario, RoutePlanInput } from "../application/usecases";
import type {
  ContainerPoint,
  ModelComparison,
  ModelId,
  OperationError,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Segment,
  SegmentExplanation,
  VentanaMapa,
} from "../domain/types";
import {
  nodeRow,
  read,
  scenarioFromDTO,
  segmentRow,
  type ExplainDTO,
  type PlanDTO,
  type PredictDTO,
  type ScenarioDTO,
} from "./mappers";

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
    async getScenario(opts?: OpcionesEscenario, signal?: AbortSignal) {
      // Una API caída o un escenario inválido no deben simular datos reales.
      const query = new URLSearchParams();
      if (opts?.bbox) {
        query.set("sur", String(opts.bbox.sur));
        query.set("norte", String(opts.bbox.norte));
        query.set("oeste", String(opts.bbox.oeste));
        query.set("este", String(opts.bbox.este));
      }
      if (opts?.limit !== undefined) query.set("limit", String(opts.limit));
      const qs = query.toString();
      return scenarioFromDTO(await get<ScenarioDTO>(`/scenario${qs ? `?${qs}` : ""}`, signal));
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
    async explainPriority(
      modelId: ModelId,
      segment: Segment,
      signal?: AbortSignal,
    ): Promise<SegmentExplanation> {
      const dto = await post<ExplainDTO>(
        "/predictions:explain",
        { model_id: modelId, segment: segmentRow(segment) },
        signal,
      );
      return {
        segmentId: dto.segment_id,
        priority: dto.priority,
        score: {
          daysWeighted: dto.score.days_weighted,
          containersWeighted: dto.score.containers_weighted,
          zoneW: dto.score.zone_w,
          complaintsWeighted: dto.score.complaints_weighted,
          total: dto.score.total,
        },
        path: dto.path.map((p) => ({ ...p })),
      };
    },
    async listContainers(
      ventana: VentanaMapa,
      limit = 2000,
      signal?: AbortSignal,
    ): Promise<{ points: ContainerPoint[]; total: number; truncated: boolean }> {
      const params = new URLSearchParams({
        sur: String(ventana.sur),
        norte: String(ventana.norte),
        oeste: String(ventana.oeste),
        este: String(ventana.este),
        limit: String(limit),
      });
      const dto = await get<{
        points: { lon: number; lat: number; days: number }[];
        total: number;
        truncated: boolean;
      }>(`/containers?${params.toString()}`, signal);
      return {
        points: dto.points.map((p) => ({ lon: p.lon, lat: p.lat, days: p.days })),
        total: dto.total,
        truncated: dto.truncated,
      };
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
