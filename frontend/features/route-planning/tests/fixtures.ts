import type {
  ModelComparison,
  PlanInput,
  Priority,
  RouteCost,
  Scenario,
  TrainingRow,
} from "../domain/types";

/** IDs de fixture: T000x/N000x como backend/tests/fixtures/*.csv. */
export const scenarioFixture: Scenario = {
  scenarioId: "piloto-mvd",
  version: "v1",
  nodes: [
    { nodeId: "N0001", lon: -56.16, lat: -34.915 },
    { nodeId: "N0002", lon: -56.155, lat: -34.91 },
    { nodeId: "N0003", lon: -56.15, lat: -34.905 },
  ],
  segments: [
    {
      segmentId: "T0001",
      originNode: "N0001",
      destinationNode: "N0002",
      lengthM: 85.5,
      zoneType: "residential",
      containerCount: 1,
      daysSinceLastCollection: 2,
      historicNeighborComplaints: 0,
    },
    {
      segmentId: "T0002",
      originNode: "N0002",
      destinationNode: "N0003",
      lengthM: 120.0,
      zoneType: "commercial",
      containerCount: 2,
      daysSinceLastCollection: 4,
      historicNeighborComplaints: 2,
    },
    {
      segmentId: "T0003",
      originNode: "N0001",
      destinationNode: "N0003",
      lengthM: 96.3,
      zoneType: "industrial",
      containerCount: 1,
      daysSinceLastCollection: 3,
      historicNeighborComplaints: 1,
    },
  ],
};

export const prioritiesFixture: Record<string, Priority> = {
  T0001: "low",
  T0002: "high",
  T0003: "medium",
};

/** Entrada de planificación (backend: nodes + segments + priorities + include). */
export const planInputFixture: PlanInput = {
  nodes: scenarioFixture.nodes,
  segments: scenarioFixture.segments,
  priorities: { ...prioritiesFixture },
  include: ["medium", "high"],
};

/**
 * Filas de entrenamiento (referencia offline de la comparación;
 * el frontend no las envía: la API solo sirve `arbol` ya ajustado).
 */
export const trainingRowsFixture: TrainingRow[] = [
  {
    zoneType: "residential",
    containerCount: 1,
    daysSinceLastCollection: 2,
    historicNeighborComplaints: 0,
    priority: "low",
  },
  {
    zoneType: "commercial",
    containerCount: 2,
    daysSinceLastCollection: 4,
    historicNeighborComplaints: 2,
    priority: "high",
  },
];

/** Backend: ModelComparison (métricas ya calculadas, offline). */
export const comparisonFixture: ModelComparison = {
  metrics: [
    {
      modelId: "arbol",
      accuracy: 0.9,
      precisionMacro: 0.88,
      recallMacro: 0.87,
      f1Macro: 0.87,
      confusionMatrix: [
        [10, 1, 0],
        [1, 9, 1],
        [0, 1, 10],
      ],
      nTrain: 9,
      nTest: 3,
    },
  ],
  baselineAccuracy: 0.33,
  bestByCv: "arbol",
  record: { rowCount: 12, testSize: 0.25, seed: 0, cvFolds: 5 },
};

/** Costo opaco del backend (total_cost_m; el frontend no lo recalcula). */
export const costFixture: RouteCost = { totalCostM: 301.8, unit: "meters" };

/**
 * Recorrido con el mismo tramo dos veces: conserva orden y duplicados.
 * La UI no los deduplica.
 */
export const repeatedRouteIds = ["T0001", "T0002", "T0001", "T0003"];
