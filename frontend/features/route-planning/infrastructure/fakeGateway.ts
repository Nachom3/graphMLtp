import type { ApiGateway } from "../application/usecases";
import type {
  CostoRecorrido,
  ErrorOperacion,
  ModeloId,
  PasoRecorrido,
  PlanInput,
  Prioridad,
  PrioridadPorTramo,
  Tramo,
  TramoId,
} from "../domain/types";
import { conRepeticiones } from "../domain/types";

export interface FakeOpciones {
  latenciaMs?: number;
  falla?: ErrorOperacion | null;
  /** Orden forzado para simular el recorrido del backend (con repeticiones). */
  ordenForzado?: TramoId[];
  modelosSoportados?: ModeloId[];
}

function esperar(ms: number, signal?: AbortSignal): Promise<void> {
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
 * Replica la semántica api-v1 (asociación por tramo_id, orden con
 * repeticiones, costo opaco). Para tests y muestra mínima sin backend.
 */
export class FakeGateway implements ApiGateway {
  constructor(
    private prioridades: Record<string, Prioridad>,
    private costo: CostoRecorrido,
    private opciones: FakeOpciones = {},
  ) {}

  private async paso(signal?: AbortSignal): Promise<void> {
    const ms = this.opciones.latenciaMs ?? 0;
    if (ms > 0) await esperar(ms, signal);
    if (this.opciones.falla) throw this.opciones.falla;
    signal?.throwIfAborted();
  }

  async salud(): Promise<{ estado: string; version: string; esquema: string }> {
    await this.paso();
    return { estado: "ok", version: "v1", esquema: "v1" };
  }

  async predecirPrioridades(
    modeloId: ModeloId,
    tramos: Tramo[],
    signal?: AbortSignal,
  ): Promise<PrioridadPorTramo[]> {
    await this.paso(signal);
    const soportados = this.opciones.modelosSoportados ?? ["arbol", "logistica", "regla-v1"];
    if (!soportados.includes(modeloId)) {
      throw { codigo: "backend", detalle: `modelo no soportado en fake: ${modeloId}` } satisfies ErrorOperacion;
    }
    return tramos.map((t) => {
      const prioridad = this.prioridades[t.tramoId];
      if (!prioridad) {
        throw { codigo: "tramo-desconocido", detalle: t.tramoId } satisfies ErrorOperacion;
      }
      return { tramoId: t.tramoId, prioridad };
    });
  }

  async planificarRecorrido(
    input: PlanInput,
    signal?: AbortSignal,
  ): Promise<{ pasos: PasoRecorrido[]; costo: CostoRecorrido }> {
    await this.paso(signal);
    const orden =
      this.opciones.ordenForzado ??
      input.tramos.filter((t) => input.incluir.includes(input.prioridades[t.tramoId])).map((t) => t.tramoId);
    for (const id of orden) {
      if (!(id in this.prioridades)) {
        throw { codigo: "tramo-desconocido", detalle: id } satisfies ErrorOperacion;
      }
    }
    return { pasos: conRepeticiones(orden), costo: this.costo };
  }
}
