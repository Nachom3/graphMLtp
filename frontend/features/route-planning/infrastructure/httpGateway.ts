import type { ApiGateway } from "../application/usecases";
import type {
  ComparacionModelos,
  CostoRecorrido,
  ErrorCodigo,
  ErrorOperacion,
  ModeloId,
  PasoRecorrido,
  PlanInput,
  PrioridadPorTramo,
  Tramo,
} from "../domain/types";

/** Formas de api-v1 (docs/contracts/api-v1.md, manda el #12). */
interface PredecirDTO {
  modelo_id: string;
  predicciones: { tramo_id: string; prioridad: "baja" | "media" | "alta" }[];
}

interface PlanificarDTO {
  orden: string[];
  repeticiones: string[];
  costo_total_m: number;
  unidad: string;
}

/** Mapea códigos api-v1 (MAYÚSCULAS) a códigos de presentación estables. */
function mapearCodigo(codigo: unknown): ErrorCodigo {
  switch (codigo) {
    case "RECORRIDO_IMPOSIBLE":
      return "recorrido-imposible";
    case "PREDICCION_SIN_TRAMO":
      return "tramo-desconocido";
    case "DATASET_INVALIDO":
    case "EVALUACION_INVALIDA":
    case "MODELO_DESCONOCIDO":
      return "backend";
    default:
      return "backend";
  }
}

/** api-v1 envuelve errores en {"detail": {"codigo", "detalle"}}. */
function aErrorOperacion(status: number, body: unknown): ErrorOperacion {
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  const codigo =
    typeof detail === "object" && detail !== null && "codigo" in detail
      ? (detail as { codigo: unknown }).codigo
      : null;
  const detalle =
    typeof detail === "object" && detail !== null && "detalle" in detail
      ? String((detail as { detalle: unknown }).detalle)
      : JSON.stringify(body);
  if (typeof codigo === "string") return { codigo: mapearCodigo(codigo), detalle };
  if (status === 404) return { codigo: "tramo-desconocido", detalle };
  return { codigo: "backend", detalle: `http ${status}` };
}

async function leer<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw aErrorOperacion(res.status, body);
  }
  return (await res.json()) as T;
}

function filaTramo(t: Tramo) {
  return {
    tramo_id: t.tramoId,
    nodo_origen: t.nodoOrigen,
    nodo_destino: t.nodoDestino,
    longitud_m: t.longitudM,
    nombre_calle: t.nombreCalle,
    tipo_zona: t.tipoZona,
    cantidad_contenedores: t.cantidadContenedores,
    dias_desde_ultima_recoleccion: t.diasDesdeUltimaRecoleccion,
    historico_quejas_vecinales: t.historicoQuejasVecinales,
  };
}

/** Adaptador HTTP: único lugar con fetch. Transforma DTOs y errores api-v1. */
export function crearHttpGateway(baseUrl: string): ApiGateway {
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw { codigo: "red" } satisfies ErrorOperacion;
    }
    return leer<T>(res);
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
      throw { codigo: "red" } satisfies ErrorOperacion;
    }
    return leer<T>(res);
  }
  return {
    salud(signal?: AbortSignal) {
      return get<{ estado: string; version: string; esquema: string }>("/salud", signal);
    },
    async predecirPrioridades(
      modeloId: ModeloId,
      tramos: Tramo[],
      signal?: AbortSignal,
    ): Promise<PrioridadPorTramo[]> {
      const dto = await post<PredecirDTO>(
        "/predicciones:predecir",
        { modelo_id: modeloId, tramos: tramos.map(filaTramo) },
        signal,
      );
      // Asociación inequívoca por tramo_id, tal cual la devuelve el backend.
      return dto.predicciones.map((p) => ({ tramoId: p.tramo_id, prioridad: p.prioridad }));
    },
    async planificarRecorrido(
      input: PlanInput,
      signal?: AbortSignal,
    ): Promise<{ pasos: PasoRecorrido[]; costo: CostoRecorrido }> {
      const dto = await post<PlanificarDTO>(
        "/recorridos:planificar",
        {
          nodos: input.nodos.map((n) => ({ nodo_id: n.nodoId, lon: n.lon, lat: n.lat })),
          tramos: input.tramos.map(filaTramo),
          prioridades: input.prioridades,
          incluir: input.incluir,
        },
        signal,
      );
      // Se conserva orden y repeticiones tal cual; el costo es opaco.
      const repetidos = new Set(dto.repeticiones);
      return {
        pasos: dto.orden.map((tramoId, orden) => ({
          orden,
          tramoId,
          repetido: repetidos.has(tramoId),
        })),
        costo: { valor: dto.costo_total_m, unidad: dto.unidad },
      };
    },
  };
}

/** Re-export para documentar la comparación versionada (no pasa por HTTP). */
export type { ComparacionModelos };
