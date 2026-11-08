import type { ApiGateway } from "../application/usecases";
import { cargarEscenario, RequestStore } from "../application/usecases";
import { seleccionarAreaVisible, type LimitesMapa } from "../components/map-view/mapViewModel";
import type { Priority, PriorityForSegment, RouteCost, RouteStep, Scenario } from "../domain/types";

/** Tope anti-abuso solo para `override` por URL (largo de query), no para el área. */
export const MAX_OVERRIDES_URL = 300;
const PRIORIDADES = new Set<Priority>(["low", "medium", "high"]);

export type ResultadoRecorridoSSR =
  | { ok: true; scenario: Scenario; priorities: PriorityForSegment[]; steps: RouteStep[]; cost: RouteCost; startNodeId: string }
  | { ok: false; error: string };

type Parametros = { limites: LimitesMapa; include: Priority[]; startNodeId: string; overrides: Map<string, Priority> };

function unico(params: URLSearchParams, key: string): string {
  const values = params.getAll(key);
  if (values.length !== 1 || !values[0].trim()) throw new Error(`El parámetro ${key} es obligatorio y no debe repetirse.`);
  return values[0].trim();
}

function numero(params: URLSearchParams, key: string): number {
  const value = Number(unico(params, key));
  if (!Number.isFinite(value)) throw new Error(`El límite ${key} debe ser un número válido.`);
  return value;
}

function leerParametros(params: URLSearchParams): Parametros {
  const limites = {
    sur: numero(params, "sur"), norte: numero(params, "norte"),
    oeste: numero(params, "oeste"), este: numero(params, "este"),
  };
  if (limites.sur < -90 || limites.norte > 90 || limites.sur >= limites.norte ||
      limites.oeste < -180 || limites.este > 180 || limites.oeste >= limites.este) {
    throw new Error("Los límites geográficos del área son inválidos.");
  }
  const include = unico(params, "include").split(",");
  if (!include.length || include.some((p) => !PRIORIDADES.has(p as Priority)) || new Set(include).size !== include.length) {
    throw new Error("Seleccioná prioridades válidas y sin repetir: low, medium o high.");
  }
  const startNodeId = unico(params, "start");
  if (startNodeId.length > 128) throw new Error("El nodo de inicio es inválido.");
  const entries = params.getAll("override");
  if (entries.length > MAX_OVERRIDES_URL) throw new Error("Demasiadas prioridades modificadas.");
  const overrides = new Map<string, Priority>();
  for (const entry of entries) {
    const parts = entry.split(":");
    if (parts.length !== 2 || !parts[0] || parts[0].length > 128 || !PRIORIDADES.has(parts[1] as Priority) || overrides.has(parts[0])) {
      throw new Error("Las prioridades modificadas deben tener formato tramo:prioridad, sin repetir tramos.");
    }
    overrides.set(parts[0], parts[1] as Priority);
  }
  return { limites, include: include as Priority[], startNodeId, overrides };
}

function mensajeError(error: unknown): string {
  if (error && typeof error === "object" && "detail" in error && typeof error.detail === "string") return error.detail;
  if (error instanceof Error) return error.message;
  return "No se pudo conectar con la API para calcular el recorrido.";
}

/** Núcleo testeable; el adaptador server-only proporciona el gateway real. */
export async function calcularRecorridoSSRConGateway(params: URLSearchParams, gateway: ApiGateway): Promise<ResultadoRecorridoSSR> {
  try {
    const { limites, include, startNodeId, overrides } = leerParametros(params);
    const completo = await gateway.getScenario({ bbox: limites });
    const validado = cargarEscenario(new RequestStore(), completo);
    if (validado.estado !== "exito") throw new Error("El escenario de la API no es válido.");
    const area = seleccionarAreaVisible(completo.nodes, completo.segments, limites);
    if (area.tramos.length === 0) throw new Error("No hay tramos en el área seleccionada.");
    if (!area.nodos.some((n) => n.nodeId === startNodeId)) throw new Error("El nodo de inicio no pertenece al área seleccionada.");
    const sinGeometria = area.tramos.find((t) => !t.geometry || t.geometry.length < 2);
    if (sinGeometria) throw new Error(`El área contiene tramos sin geometría vial; no se puede renderizar el recorrido real. Tramo ${sinGeometria.segmentId} (${sinGeometria.originNode} → ${sinGeometria.destinationNode}).`);
    const ids = new Set(area.tramos.map((t) => t.segmentId));
    for (const id of overrides.keys()) if (!ids.has(id)) throw new Error(`El tramo modificado ${id} no pertenece al área seleccionada.`);
    const predicciones = await gateway.predictPriorities("arbol", area.tramos);
    const porTramo = new Map<string, Priority>();
    for (const prediction of predicciones) {
      if (!ids.has(prediction.segmentId) || porTramo.has(prediction.segmentId) || !PRIORIDADES.has(prediction.priority)) {
        throw new Error("Las predicciones de la API no corresponden al área seleccionada.");
      }
      porTramo.set(prediction.segmentId, prediction.priority);
    }
    if (porTramo.size !== ids.size) throw new Error("Faltan predicciones para tramos del área seleccionada.");
    for (const [id, priority] of overrides) porTramo.set(id, priority);
    const priorities = area.tramos.map(({ segmentId }) => ({ segmentId, priority: porTramo.get(segmentId)! }));
    const { steps, cost } = await gateway.planRoute({
      nodes: area.nodos, segments: area.tramos, priorities: Object.fromEntries(porTramo), include, startNodeId,
    });
    if (!steps.length || steps.some((step) => !ids.has(step.segmentId))) throw new Error("La API devolvió un recorrido vacío o con tramos fuera del área.");
    return { ok: true, scenario: { ...completo, nodes: area.nodos, segments: area.tramos }, priorities, steps, cost, startNodeId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
