import type { Priority, Segment } from "./types";

/**
 * Desglose de la regla sintética #18 que el árbol aprende.
 * score = 2*días + 1*contenedores + 1*zona_w + 2*quejas
 * zona_w = {residencial: 0, industrial: 1, comercial: 2}
 * baja si score <= 0 | media si 1..2 | alta si > 2
 * No predice: solo muestra el cálculo que la etiqueta construida usa.
 */
export const ZONA_PESO: Record<Segment["zoneType"], number> = {
  residential: 0,
  industrial: 1,
  commercial: 2,
};

export interface DesgloseScore {
  diasPonderado: number;
  contenedoresPonderado: number;
  zonaW: number;
  quejasPonderado: number;
  score: number;
  prioridadRegla: Priority;
}

export function prioridadDeScore(score: number): Priority {
  if (score <= 0) return "low";
  if (score <= 2) return "medium";
  return "high";
}

export function desgloseScore(
  segment: Pick<
    Segment,
    "zoneType" | "containerCount" | "daysSinceLastCollection" | "historicNeighborComplaints"
  >,
): DesgloseScore {
  const diasPonderado = 2 * segment.daysSinceLastCollection;
  const contenedoresPonderado = 1 * segment.containerCount;
  const zonaW = ZONA_PESO[segment.zoneType] ?? 0;
  const quejasPonderado = 2 * segment.historicNeighborComplaints;
  const score = diasPonderado + contenedoresPonderado + zonaW + quejasPonderado;
  return {
    diasPonderado,
    contenedoresPonderado,
    zonaW,
    quejasPonderado,
    score,
    prioridadRegla: prioridadDeScore(score),
  };
}
