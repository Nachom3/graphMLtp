import { describe, expect, it } from "vitest";
import { desgloseScore, prioridadDeScore } from "../domain/explain";

describe("prioridadDeScore: umbrales de la regla #18", () => {
  it("baja si score <= 0, media si 1..2, alta si > 2", () => {
    expect(prioridadDeScore(0)).toBe("low");
    expect(prioridadDeScore(-3)).toBe("low");
    expect(prioridadDeScore(1)).toBe("medium");
    expect(prioridadDeScore(2)).toBe("medium");
    expect(prioridadDeScore(3)).toBe("high");
  });
});

describe("desgloseScore: muestra el cálculo término por término", () => {
  it("tramo con varios contenedores: el peso de contenedores empuja a alta", () => {
    const d = desgloseScore({
      zoneType: "residential",
      containerCount: 3,
      daysSinceLastCollection: 0,
      historicNeighborComplaints: 0,
    });
    expect(d).toMatchObject({
      diasPonderado: 0,
      contenedoresPonderado: 3,
      zonaW: 0,
      quejasPonderado: 0,
      score: 3,
      prioridadRegla: "high",
    });
  });

  it("tramo sin contenedores puede ser alta por días + zona comercial", () => {
    const d = desgloseScore({
      zoneType: "commercial",
      containerCount: 0,
      daysSinceLastCollection: 1,
      historicNeighborComplaints: 0,
    });
    expect(d.score).toBe(4);
    expect(d.prioridadRegla).toBe("high");
  });
});
