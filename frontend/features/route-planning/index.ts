export {
  cargarEscenario,
  consultarComparacion,
  ejecutar,
  marcarRepeticiones,
  RequestStore,
  solicitarPrioridades,
  solicitarRecorrido,
  verificarSalud,
} from "./application/usecases";
export type { ApiGateway } from "./application/usecases";
export { FakeGateway } from "./infrastructure/fakeGateway";
export type { FakeOpciones } from "./infrastructure/fakeGateway";
export { crearHttpGateway } from "./infrastructure/httpGateway";
export { conRepeticiones, LEYENDA_PRIORIDAD } from "./domain/types";
export type {
  ComparacionModelos,
  CostoRecorrido,
  ErrorCodigo,
  ErrorOperacion,
  EstadoOperacion,
  Escenario,
  ModeloId,
  Nodo,
  NodoId,
  PasoRecorrido,
  PlanInput,
  Prioridad,
  PrioridadPorTramo,
  TipoZona,
  Tramo,
  TramoId,
} from "./domain/types";
export { MapView, toMapViewModel } from "./components/map-view";
export type { MapViewModel, TramoVisible } from "./components/map-view";
export { useOperacion } from "./components/use-operation";
export { LeyendaPrioridades } from "./components/priority-legend";
export { ResumenRecorrido } from "./components/route-summary";
