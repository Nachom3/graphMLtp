/** Tipos y reglas de presentación (puros: sin React, HTTP ni Leaflet). */

export type Prioridad = "baja" | "media" | "alta";
export type TipoZona = "residencial" | "comercial" | "industrial";

/** Identificadores estables (dataset #8): tramo_id = reftramo IDE. */
export type TramoId = string;
export type NodoId = string;

/** Modelos del backend (api-v1; #10 agrega reales). */
export type ModeloId = "arbol" | "logistica" | "regla-v1";

export interface Nodo {
  nodoId: NodoId;
  lon: number; // WGS84 EPSG:4326
  lat: number; // WGS84 EPSG:4326
}

export interface Tramo {
  tramoId: TramoId;
  nodoOrigen: NodoId;
  nodoDestino: NodoId;
  longitudM: number; // metros, geodésica (no euclídea en grados)
  nombreCalle: string;
  tipoZona: TipoZona;
  cantidadContenedores: number;
  diasDesdeUltimaRecoleccion: number;
  historicoQuejasVecinales: number;
}

export interface Escenario {
  escenarioId: string;
  version: string;
  nodos: Nodo[];
  tramos: Tramo[];
}

export interface MetricasModelo {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ComparacionModelos {
  configuracion: Record<string, string>;
  metricasPorModelo: Record<string, MetricasModelo>;
  baseline: string;
  matrizConfusion: number[][];
}

export interface PrioridadPorTramo {
  tramoId: TramoId;
  prioridad: Prioridad;
}

/**
 * Fila de entrenamiento etiquetada (api-v1 `filas_entrenamiento`).
 * Misma forma que las `filas` de `/modelos/comparar`: features + etiqueta.
 * `arbol`/`logistica` la exigen (sin ella el backend devuelve 422);
 * `regla-v1` no la necesita y acepta un arreglo vacío.
 */
export interface FilaEntrenamiento {
  tipoZona: TipoZona;
  cantidadContenedores: number;
  diasDesdeUltimaRecoleccion: number;
  historicoQuejasVecinales: number;
  prioridadRecoleccion: Prioridad;
}

/** Un paso del recorrido; el mismo tramo puede aparecer varias veces. */
export interface PasoRecorrido {
  orden: number; // 0-based, conserva el orden devuelto
  tramoId: TramoId;
  repetido: boolean; // true si el tramo ya apareció antes
}

/**
 * Costo opaco: lo define el backend (costo_total_m, suma con repeticiones).
 * El frontend nunca lo recalcula.
 */
export interface CostoRecorrido {
  readonly valor: number;
  readonly unidad: string; // p. ej. "metros"
}

/** Entrada de planificación (api-v1: nodos + tramos + prioridades + incluir). */
export interface PlanInput {
  nodos: Nodo[];
  tramos: Tramo[];
  prioridades: Record<TramoId, Prioridad>;
  incluir: Prioridad[];
}

export type ErrorCodigo =
  | "red"
  | "version-incompatible"
  | "seleccion-vacia"
  | "tramo-desconocido"
  | "recorrido-imposible"
  | "backend";

export interface ErrorOperacion {
  codigo: ErrorCodigo;
  detalle?: string;
}

export type EstadoOperacion<T> =
  | { estado: "carga"; requestId: number }
  | { estado: "vacio"; motivo: string }
  | { estado: "exito"; requestId: number; datos: T }
  | { estado: "error"; requestId: number; error: ErrorOperacion };

/** Marca pasos repetidos sin deduplicar: conserva orden y duplicados. */
export function conRepeticiones(tramoIds: TramoId[]): PasoRecorrido[] {
  const vistos = new Set<TramoId>();
  return tramoIds.map((tramoId, i) => {
    const repetido = vistos.has(tramoId);
    vistos.add(tramoId);
    return { orden: i, tramoId, repetido };
  });
}

/** Leyenda accesible: etiqueta + patrón, nunca solo color. */
export const LEYENDA_PRIORIDAD: Record<Prioridad, { etiqueta: string; patron: string }> = {
  alta: { etiqueta: "Alta", patron: "línea gruesa sólida" },
  media: { etiqueta: "Media", patron: "línea media rayada" },
  baja: { etiqueta: "Baja", patron: "línea fina punteada" },
};
