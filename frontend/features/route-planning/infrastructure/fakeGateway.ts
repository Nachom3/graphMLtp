import type { ApiGateway, RoutePlanInput } from "../application/usecases";
import type {
  ContainerPoint,
  ModelId,
  OperationError,
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  Segment,
  SegmentExplanation,
  SegmentId,
  VentanaMapa,
} from "../domain/types";
import { conRepeticiones } from "../domain/types";
import { demoScenario } from "./demoScenario";

export interface FakeOptions {
  latencyMs?: number;
  failure?: OperationError | null;
  /** Orden forzado para simular el recorrido del backend (con repeticiones). */
  forcedOrder?: SegmentId[];
  supportedModels?: ModelId[];
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("abort", "AbortError"));
    });
  });
}

/**
 * Gateway fake en memoria: datos controlados, latencia/fallos configurables.
 * Replica la semántica del backend (asociación por segment_id, orden con
 * repeticiones, costo opaco). Para tests y muestra mínima sin backend.
 */
export class FakeGateway implements ApiGateway {
  constructor(
    private priorities: Record<string, Priority>,
    private cost: RouteCost,
    private options: FakeOptions = {},
  ) {}

  private async step(signal?: AbortSignal): Promise<void> {
    const ms = this.options.latencyMs ?? 0;
    if (ms > 0) await wait(ms, signal);
    if (this.options.failure) throw this.options.failure;
    signal?.throwIfAborted();
  }

  async health(): Promise<{ status: string; version: string; schema: string }> {
    await this.step();
    return { status: "ok", version: "v1", schema: "v1" };
  }

  async getScenario(signal?: AbortSignal): Promise<Scenario> {
    await this.step(signal);
    return demoScenario;
  }

  async predictPriorities(
    modelId: ModelId,
    segments: Segment[],
    signal?: AbortSignal,
  ): Promise<PriorityForSegment[]> {
    await this.step(signal);
    const supported = this.options.supportedModels ?? ["arbol"];
    if (!supported.includes(modelId)) {
      throw { code: "backend", detail: `modelo no soportado en fake: ${modelId}` } satisfies OperationError;
    }
    return segments.map((s) => {
      const priority = this.priorities[s.segmentId];
      if (!priority) {
        throw { code: "prediction-without-segment", detail: s.segmentId } satisfies OperationError;
      }
      return { segmentId: s.segmentId, priority };
    });
  }

  async explainPriority(
    modelId: ModelId,
    segment: Segment,
    signal?: AbortSignal,
  ): Promise<SegmentExplanation> {
    await this.step(signal);
    const priority = this.priorities[segment.segmentId];
    if (!priority) {
      throw { code: "prediction-without-segment", detail: segment.segmentId } satisfies OperationError;
    }
    void modelId;
    return {
      segmentId: segment.segmentId,
      priority,
      score: {
        daysWeighted: 2 * segment.daysSinceLastCollection,
        containersWeighted: segment.containerCount,
        zoneW: 0,
        complaintsWeighted: 2 * segment.historicNeighborComplaints,
        total: 2 * segment.daysSinceLastCollection + segment.containerCount + 2 * segment.historicNeighborComplaints,
      },
      path: [{ node: 0, leaf: true }],
    };
  }

  async listContainers(
    ventana: VentanaMapa,
    limit = 2000,
    signal?: AbortSignal,
  ): Promise<{ points: ContainerPoint[]; total: number; truncated: boolean }> {
    await this.step(signal);
    void ventana;
    void limit;
    return { points: [], total: 0, truncated: false };
  }

  async planRoute(
    input: RoutePlanInput,
    signal?: AbortSignal,
  ): Promise<{ steps: RouteStep[]; cost: RouteCost }> {
    await this.step(signal);
    const order =
      this.options.forcedOrder ??
      input.segments.filter((s) => input.include.includes(input.priorities[s.segmentId])).map((s) => s.segmentId);
    for (const id of order) {
      if (!(id in this.priorities)) {
        throw { code: "prediction-without-segment", detail: id } satisfies OperationError;
      }
    }
    return { steps: conRepeticiones(order), cost: this.cost };
  }
}
