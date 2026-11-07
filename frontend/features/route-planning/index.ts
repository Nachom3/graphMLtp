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
export type { FakeOptions } from "./infrastructure/fakeGateway";
export { crearHttpGateway } from "./infrastructure/httpGateway";
export { conRepeticiones, LEYENDA_PRIORIDAD } from "./domain/types";
export type {
  ErrorCode,
  ModelComparison,
  ModelId,
  ModelMetrics,
  Node,
  NodeId,
  OperationError,
  OperationState,
  PlanInput,
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  Segment,
  SegmentId,
  TrainingRow,
  ZoneType,
} from "./domain/types";
export { MapView, toMapViewModel } from "./components/map-view";
export type { MapViewModel, TramoVisible } from "./components/map-view";
export { useOperacion } from "./components/use-operation";
export { LeyendaPrioridades } from "./components/priority-legend";
export { ResumenRecorrido } from "./components/route-summary";
