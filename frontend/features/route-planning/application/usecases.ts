import type {
  ComparacionModelos,
  CostoRecorrido,
  ErrorOperacion,
  Escenario,
  EstadoOperacion,
  ModeloId,
  PasoRecorrido,
  PlanInput,
  PrioridadPorTramo,
  Tramo,
} from "../domain/types";
import { conRepeticiones } from "../domain/types";

/**
 * Puerto pequeño sustituible (DIP/ISP), alineado con api-v1 del #12.
 * La app depende de esto; HTTP y fake lo implementan. Sin fetch disperso.
 */
export interface ApiGateway {
  salud(signal?: AbortSignal): Promise<{ estado: string; version: string; esquema: string }>;
  predecirPrioridades(
    modeloId: ModeloId,
    tramos: Tramo[],
    signal?: AbortSignal,
  ): Promise<PrioridadPorTramo[]>;
  planificarRecorrido(
    input: PlanInput,
    signal?: AbortSignal,
  ): Promise<{ pasos: PasoRecorrido[]; costo: CostoRecorrido }>;
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
): Promise<EstadoOperacion<T>> {
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

function aError(e: unknown): ErrorOperacion {
  if (e instanceof DOMException && e.name === "AbortError") {
    return { codigo: "red", detalle: "solicitud cancelada" };
  }
  if (typeof e === "object" && e !== null && "codigo" in e) {
    return e as ErrorOperacion;
  }
  if (e instanceof Error) return { codigo: "backend", detalle: e.message };
  return { codigo: "backend" };
}

/* Casos de uso (coordinan; no conocen React/HTTP/Leaflet) */

export function verificarSalud(
  gw: ApiGateway,
  store: RequestStore,
  signal?: AbortSignal,
): Promise<EstadoOperacion<{ estado: string; version: string; esquema: string }>> {
  return ejecutar(store, gw.salud(signal), (s) =>
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
  datos: Escenario,
): EstadoOperacion<Escenario> {
  const requestId = store.siguiente();
  if (datos.version !== "v1") {
    return {
      estado: "error",
      requestId,
      error: { codigo: "version-incompatible", detalle: datos.version },
    };
  }
  if (datos.tramos.length === 0) return { estado: "vacio", motivo: "escenario sin tramos" };
  const nodos = new Set(datos.nodos.map((n) => n.nodoId));
  const roto = datos.tramos.find((t) => !nodos.has(t.nodoOrigen) || !nodos.has(t.nodoDestino));
  if (roto) {
    return {
      estado: "error",
      requestId,
      error: { codigo: "backend", detalle: `tramo ${roto.tramoId} referencia nodos inexistentes` },
    };
  }
  return { estado: "exito", requestId, datos };
}

/**
 * Consultar comparación: presenta resultados YA calculados (offline).
 * api-v1 advierte no llamar a /modelos/comparar desde visualización:
 * por eso no pasa por HTTP; los datos versionados los provee el llamador.
 */
export function consultarComparacion(
  store: RequestStore,
  datos: ComparacionModelos,
): EstadoOperacion<ComparacionModelos> {
  const requestId = store.siguiente();
  return { estado: "exito", requestId, datos };
}

export function solicitarPrioridades(
  gw: ApiGateway,
  store: RequestStore,
  modeloId: ModeloId,
  tramos: Tramo[],
  signal?: AbortSignal,
): Promise<EstadoOperacion<PrioridadPorTramo[]>> {
  if (tramos.length === 0) {
    return Promise.resolve({
      estado: "vacio",
      motivo: "selección vacía",
    } as EstadoOperacion<PrioridadPorTramo[]>);
  }
  return ejecutar(store, gw.predecirPrioridades(modeloId, tramos, signal), (ps) =>
    ps.length === 0 ? "sin prioridades" : null,
  );
}

export function solicitarRecorrido(
  gw: ApiGateway,
  store: RequestStore,
  input: PlanInput,
  signal?: AbortSignal,
): Promise<EstadoOperacion<{ pasos: PasoRecorrido[]; costo: CostoRecorrido }>> {
  if (input.tramos.length === 0) {
    return Promise.resolve({
      estado: "vacio",
      motivo: "selección vacía",
    } as EstadoOperacion<{ pasos: PasoRecorrido[]; costo: CostoRecorrido }>);
  }
  return ejecutar(store, gw.planificarRecorrido(input, signal), (r) =>
    r.pasos.length === 0 ? "recorrido vacío" : null,
  );
}

/** Re-marca repeticiones del lado presentación (no toca el contrato). */
export function marcarRepeticiones(pasos: PasoRecorrido[]): PasoRecorrido[] {
  return conRepeticiones(pasos.map((p) => p.tramoId)).map((m, i) => ({
    ...m,
    orden: pasos[i]?.orden ?? i,
  }));
}
