import type { ComparacionModelos, CostoRecorrido, Escenario, FilaEntrenamiento, PlanInput, Prioridad } from "../domain/types";

/** IDs de fixture (alias ilustrativos; reales: reftramo IDE según api-v1). */
export const escenarioFixture: Escenario = {
  escenarioId: "piloto-mvd",
  version: "v1",
  nodos: [
    { nodoId: "N0001", lon: -56.16, lat: -34.915 },
    { nodoId: "N0002", lon: -56.155, lat: -34.91 },
    { nodoId: "N0003", lon: -56.15, lat: -34.905 },
  ],
  tramos: [
    {
      tramoId: "T0001",
      nodoOrigen: "N0001",
      nodoDestino: "N0002",
      longitudM: 85.5,
      nombreCalle: "Calle A",
      tipoZona: "residencial",
      cantidadContenedores: 1,
      diasDesdeUltimaRecoleccion: 2,
      historicoQuejasVecinales: 0,
    },
    {
      tramoId: "T0002",
      nodoOrigen: "N0002",
      nodoDestino: "N0003",
      longitudM: 120.0,
      nombreCalle: "Calle B",
      tipoZona: "comercial",
      cantidadContenedores: 2,
      diasDesdeUltimaRecoleccion: 4,
      historicoQuejasVecinales: 2,
    },
    {
      tramoId: "T0003",
      nodoOrigen: "N0001",
      nodoDestino: "N0003",
      longitudM: 96.3,
      nombreCalle: "Calle C",
      tipoZona: "industrial",
      cantidadContenedores: 1,
      diasDesdeUltimaRecoleccion: 3,
      historicoQuejasVecinales: 1,
    },
  ],
};

export const prioridadesFixture: Record<string, Prioridad> = {
  "T0001": "baja",
  "T0002": "alta",
  "T0003": "media",
};

/**
 * Filas de entrenamiento (api-v1 `filas_entrenamiento`): features + etiqueta.
 * `arbol`/`logistica` las exigen; `regla-v1` acepta `[]`.
 */
export const filasEntrenamientoFixture: FilaEntrenamiento[] = [
  {
    tipoZona: "residencial",
    cantidadContenedores: 1,
    diasDesdeUltimaRecoleccion: 2,
    historicoQuejasVecinales: 0,
    prioridadRecoleccion: "baja",
  },
  {
    tipoZona: "comercial",
    cantidadContenedores: 2,
    diasDesdeUltimaRecoleccion: 4,
    historicoQuejasVecinales: 2,
    prioridadRecoleccion: "alta",
  },
];

/** Entrada de planificación api-v1: grafo + prioridades + incluir. */
export const planInputFixture: PlanInput = {
  nodos: escenarioFixture.nodos,
  tramos: escenarioFixture.tramos,
  prioridades: { ...prioridadesFixture },
  incluir: ["media", "alta"],
};

export const comparacionFixture: ComparacionModelos = {
  configuracion: { particion: "stratify,seed=0", cv: "5-folds" },
  metricasPorModelo: {
    arbol: { accuracy: 0.9, precision: 0.88, recall: 0.87, f1: 0.87 },
    logistica: { accuracy: 0.85, precision: 0.84, recall: 0.83, f1: 0.83 },
  },
  baseline: "predecir siempre la mayoría",
  matrizConfusion: [
    [10, 1, 0],
    [1, 9, 1],
    [0, 1, 10],
  ],
};

/** Costo opaco del backend (costo_total_m; el frontend no lo recalcula). */
export const costoFixture: CostoRecorrido = { valor: 301.8, unidad: "metros" };

/**
 * Recorrido con el mismo tramo dos veces: conserva orden y duplicados.
 * La UI no los deduplica.
 */
export const recorridoRepetidoIds = ["T0001", "T0002", "T0001", "T0003"];
