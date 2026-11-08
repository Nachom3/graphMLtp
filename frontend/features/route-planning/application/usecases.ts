import type {
  ContainerPoint,
  ModelComparison,
  ModelId,
  OperationError,
  OperationState,
  PlanInput,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  Segment,
  SegmentExplanation,
  VentanaMapa,
} from "../domain/types";
import { conRepeticiones } from "../domain/types";

/**
 * Puerto pequeño sustituible (DIP/ISP), alineado con el backend.
 * La app depende de esto; HTTP y fake lo implementan. Sin fetch disperso.
 */
export type RoutePlanInput = PlanInput & { startNodeId: string };

/** Recorte que pide el frontend: el máximo lo manda el cliente (S3). */
export interface OpcionesEscenario {
  bbox?: VentanaMapa;
  limit?: number;
}

export interface ApiGateway {
  health(signal?: AbortSignal): Promise<{ status: string; version: string; schema: string }>;
  getScenario(opts?: OpcionesEscenario, signal?: AbortSignal): Promise<Scenario>;
  predictPriorities(
    modelId: ModelId,
    segments: Segment[],
    signal?: AbortSignal,
  ): Promise<PriorityForSegment[]>;
  explainPriority(
    modelId: ModelId,
    segment: Segment,
    signal?: AbortSignal,
  ): Promise<SegmentExplanation>;
  listContainers(
    ventana: VentanaMapa,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<{ points: ContainerPoint[]; total: number; truncated: boolean }>;
  planRoute(
    input: RoutePlanInput,
    signal?: AbortSignal,
  ): Promise<{ steps: RouteStep[]; cost: RouteCost }>;
}

/** Fuente de verdad mínima de la solicitud vigente (sin store global). */
export class RequestStore {
  private ultimo = 0;
  siguiente(): number {
    this.ultimo += 1;
    return this.ultimo;
  }
  esVigente(requestId: number): boolean {
    return requestId === this.ultimo;
  }
}

/** Envuelve una promesa del gateway con estados carga/vacío/éxito/error. */
export async function ejecutar<T>(
  store: RequestStore,
  promesa: Promise<T>,
  aVacio: (datos: T) => string | null,
): Promise<OperationState<T>> {
  const requestId = store.siguiente();
  try {
    const datos = await promesa;
    if (!store.esVigente(requestId)) {
      // Respuesta tardía: no sobrescribe la vigente; se descarta.
      return { estado: "carga", requestId };
    }
    const motivo = aVacio(datos);
    if (motivo) return { estado: "vacio", motivo };
    return { estado: "exito", requestId, datos };
  } catch (e) {
    if (!store.esVigente(requestId)) return { estado: "carga", requestId };
    return { estado: "error", requestId, error: aError(e) };
  }
}

function aError(e: unknown): OperationError {
  if (e instanceof DOMException && e.name === "AbortError") {
    return { code: "network", detail: "solicitud cancelada" };
  }
  if (typeof e === "object" && e !== null && "code" in e) {
    return e as OperationError;
  }
  if (e instanceof Error) return { code: "backend", detail: e.message };
  return { code: "backend" };
}

/* Casos de uso (coordinan; no conocen React/HTTP/Leaflet) */

export function verificarSalud(
  gw: ApiGateway,
  store: RequestStore,
  signal?: AbortSignal,
): Promise<OperationState<{ status: string; version: string; schema: string }>> {
  return ejecutar(store, gw.health(signal), (s) =>
    s.version !== "v1" ? `versión incompatible: ${s.version}` : null,
  );
}

/**
 * Cargar escenario: valida grafo, datos y metadatos consistentes sobre
 * datos versionados (el dataset final lo produce el #9; acá va el fixture
 * v1 como fuente versionada para tests y muestra).
 */
export function cargarEscenario(
  store: RequestStore,
  datos: Scenario,
): OperationState<Scenario> {
  const requestId = store.siguiente();
  if (datos.version !== "v1") {
    return {
      estado: "error",
      requestId,
      error: { code: "version-mismatch", detail: datos.version },
    };
  }
  if (datos.segments.length === 0) return { estado: "vacio", motivo: "escenario sin tramos" };
  const nodos = new Set(datos.nodes.map((n) => n.nodeId));
  const roto = datos.segments.find((t) => !nodos.has(t.originNode) || !nodos.has(t.destinationNode));
  if (roto) {
    return {
      estado: "error",
      requestId,
      error: { code: "backend", detail: `segmento ${roto.segmentId} referencia nodos inexistentes` },
    };
  }
  return { estado: "exito", requestId, datos };
}

/**
 * Consultar comparación: presenta resultados YA calculados (offline).
 * El backend pide no llamar a comparar desde visualización:
 * por eso no pasa por HTTP; los datos versionados los provee el llamador.
 */
export function consultarComparacion(
  store: RequestStore,
  datos: ModelComparison,
): OperationState<ModelComparison> {
  const requestId = store.siguiente();
  return { estado: "exito", requestId, datos };
}

export async function obtenerEscenario(
  gw: ApiGateway,
  store: RequestStore,
  signal?: AbortSignal,
  opts?: OpcionesEscenario,
): Promise<OperationState<Scenario>> {
  const result = await ejecutar(store, gw.getScenario(opts, signal), (scenario) =>
    scenario.segments.length === 0 ? "escenario sin tramos" : null,
  );
  if (result.estado !== "exito") return result;
  return cargarEscenario(store, result.datos);
}

export function solicitarPrioridades(
  gw: ApiGateway,
  store: RequestStore,
  modelId: ModelId,
  segments: Segment[],
  signal?: AbortSignal,
): Promise<OperationState<PriorityForSegment[]>> {
  if (segments.length === 0) {
    return Promise.resolve({
      estado: "vacio",
      motivo: "selección vacía",
    } as OperationState<PriorityForSegment[]>);
  }
  return ejecutar(store, gw.predictPriorities(modelId, segments, signal), (ps) =>
    ps.length === 0 ? "sin prioridades" : null,
  );
}

export function solicitarExplicacion(
  gw: ApiGateway,
  store: RequestStore,
  modelId: ModelId,
  segment: Segment,
  signal?: AbortSignal,
): Promise<OperationState<SegmentExplanation>> {
  return ejecutar(store, gw.explainPriority(modelId, segment, signal), (explicacion) =>
    explicacion.path.length === 0 ? "sin explicación" : null,
  );
}

export function solicitarContenedores(
  gw: ApiGateway,
  store: RequestStore,
  ventana: VentanaMapa,
  limit = 2000,
  signal?: AbortSignal,
): Promise<
  OperationState<{ points: ContainerPoint[]; total: number; truncated: boolean }>
> {
  return ejecutar(store, gw.listContainers(ventana, limit, signal), () => null);
}

export function solicitarRecorrido(
  gw: ApiGateway,
  store: RequestStore,
  input: RoutePlanInput,
  signal?: AbortSignal,
): Promise<OperationState<{ steps: RouteStep[]; cost: RouteCost }>> {
  if (input.segments.length === 0) {
    return Promise.resolve({
      estado: "vacio",
      motivo: "selección vacía",
    } as OperationState<{ steps: RouteStep[]; cost: RouteCost }>);
  }
  return ejecutar(store, gw.planRoute(input, signal), (r) =>
    r.steps.length === 0 ? "recorrido vacío" : null,
  );
}

/** Re-marca repeticiones del lado presentación (no toca el contrato). */
export function marcarRepeticiones(steps: RouteStep[]): RouteStep[] {
  return conRepeticiones(steps.map((p) => p.segmentId)).map((m, i) => ({
    ...m,
    order: steps[i]?.order ?? i,
  }));
}
