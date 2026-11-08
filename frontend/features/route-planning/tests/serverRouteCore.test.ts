import { describe, expect, it, vi } from "vitest";
import type { ApiGateway } from "../application/usecases";
import type { Scenario } from "../domain/types";
import { calcularRecorridoSSRConGateway } from "../server/serverRouteCore";

const escenario: Scenario = {
  scenarioId: "ejemplo", version: "v1",
  nodes: [
    { nodeId: "A", lat: -34.91, lon: -56.16 },
    { nodeId: "B", lat: -34.91, lon: -56.15 },
    { nodeId: "C", lat: -34.5, lon: -56.5 },
    { nodeId: "D", lat: -34.5, lon: -56.4 },
  ],
  segments: [
    { segmentId: "inside", originNode: "A", destinationNode: "B", lengthM: 100,
      zoneType: "residential", containerCount: 1, daysSinceLastCollection: 1,
      historicNeighborComplaints: 0, geometry: [[-34.91, -56.16], [-34.909, -56.155], [-34.91, -56.15]] },
    { segmentId: "outside", originNode: "C", destinationNode: "D", lengthM: 100,
      zoneType: "residential", containerCount: 1, daysSinceLastCollection: 1,
      historicNeighborComplaints: 0, geometry: [[-34.5, -56.5], [-34.5, -56.4]] },
  ],
};

function gateway(scenario = escenario): ApiGateway {
  return {
    health: vi.fn(),
    getScenario: vi.fn().mockResolvedValue(scenario),
    predictPriorities: vi.fn().mockResolvedValue([{ segmentId: "inside", priority: "high" }]),
    listContainers: vi.fn().mockResolvedValue({ points: [], total: 0, truncated: false }),
    explainPriority: vi.fn().mockResolvedValue({
      segmentId: "inside",
      priority: "high",
      score: { daysWeighted: 2, containersWeighted: 1, zoneW: 0, complaintsWeighted: 0, total: 3 },
      path: [{ node: 0, leaf: true }],
    }),
    planRoute: vi.fn().mockResolvedValue({
      steps: [{ order: 0, segmentId: "inside", repeated: false }, { order: 1, segmentId: "inside", repeated: true }],
      cost: { totalCostM: 200, unit: "meters", coverage: 1 },
    }),
  };
}

function params(extra = ""): URLSearchParams {
  return new URLSearchParams(`sur=-34.92&norte=-34.90&oeste=-56.17&este=-56.14&include=high,medium&start=A${extra}`);
}

describe("cálculo SSR del recorrido", () => {
  it("limita escenario, predice el área, aplica override y conserva geometría y orden", async () => {
    const gw = gateway();
    const result = await calcularRecorridoSSRConGateway(params("&override=inside:medium"), gw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.segments.map((s) => s.segmentId)).toEqual(["inside"]);
    expect(result.scenario.nodes.map((n) => n.nodeId)).toEqual(["A", "B"]);
    expect(result.scenario.segments[0].geometry).toHaveLength(3);
    expect(result.priorities).toEqual([{ segmentId: "inside", priority: "medium" }]);
    expect(result.steps.map((s) => s.segmentId)).toEqual(["inside", "inside"]);
    expect(gw.predictPriorities).toHaveBeenCalledWith("arbol", [escenario.segments[0]]);
    expect(gw.planRoute).toHaveBeenCalledWith(expect.objectContaining({
      priorities: { inside: "medium" }, include: ["high", "medium"], startNodeId: "A",
    }));
  });

  it("rechaza límites, parámetros repetidos y prioridades inválidas antes de llamar API", async () => {
    for (const query of ["", "sur=0&norte=0&oeste=0&este=1&include=high&start=A", `${params()}&sur=-20`, `${params()}&override=inside:other`]) {
      const gw = gateway();
      expect((await calcularRecorridoSSRConGateway(new URLSearchParams(query), gw)).ok).toBe(false);
      expect(gw.getScenario).not.toHaveBeenCalled();
    }
  });

  it("rechaza inicio u override fuera del área y no llama al modelo", async () => {
    for (const query of [params().toString().replace("start=A", "start=C"), `${params()}&override=outside:high`]) {
      const gw = gateway();
      expect((await calcularRecorridoSSRConGateway(new URLSearchParams(query), gw)).ok).toBe(false);
      expect(gw.predictPriorities).not.toHaveBeenCalled();
    }
  });

  it("ya no topa el área en 300 tramos: pide el bbox y el máximo lo manda el frontend", async () => {
    const extra = Array.from({ length: 300 }, (_, i) => ({ ...escenario.segments[0], segmentId: `extra${i}` }));
    const gw = gateway({ ...escenario, segments: [...escenario.segments, ...extra] });
    const resultado = await calcularRecorridoSSRConGateway(params(), gw);
    expect(gw.getScenario).toHaveBeenCalledWith({
      bbox: { sur: -34.92, norte: -34.9, oeste: -56.17, este: -56.14 },
    });
    expect(resultado).toMatchObject({ ok: false, error: expect.stringMatching(/Faltan predicciones/) });
    const sinGeometria = gateway({ ...escenario, segments: [{ ...escenario.segments[0], geometry: undefined }] });
    expect(await calcularRecorridoSSRConGateway(params(), sinGeometria)).toMatchObject({ ok: false, error: expect.stringMatching(/sin geometría.*inside.*A.*B/) });
  });

  it("rechaza predicciones incompletas y comunica errores de API", async () => {
    const gw = gateway();
    vi.mocked(gw.predictPriorities).mockResolvedValue([]);
    expect(await calcularRecorridoSSRConGateway(params(), gw)).toMatchObject({ ok: false, error: expect.stringMatching(/Faltan predicciones/) });
    const down = gateway();
    vi.mocked(down.getScenario).mockRejectedValue({ code: "network" });
    expect(await calcularRecorridoSSRConGateway(params(), down)).toMatchObject({ ok: false, error: expect.stringMatching(/conectar/) });
  });
});
