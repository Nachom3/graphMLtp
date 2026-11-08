import { describe, expect, it } from "vitest";
import { toMapViewModel } from "../components/map-view/mapViewModel";
import { prioritiesFixture, repeatedRouteIds, scenarioFixture } from "./fixtures";
import { conRepeticiones } from "../domain/types";

describe("mapViewModel: puro, sin Leaflet ni DOM", () => {
  const nodos = new Map(scenarioFixture.nodes.map((n) => [n.nodeId, { lat: n.lat, lon: n.lon }]));
  const prioridades = Object.entries(prioritiesFixture).map(([segmentId, priority]) => ({
    segmentId,
    priority,
  }));
  const pasos = conRepeticiones(repeatedRouteIds);

  it("cuenta repeticiones por tramo y marca el paso actual", () => {
    const vm = toMapViewModel({
      tramos: scenarioFixture.segments,
      nodos,
      prioridades,
      pasos,
      mandatory: ["T0001", "T0002"],
      transit: ["T0003"],
      pasoActual: 2,
    });
    const t0001 = vm.tramos.find((t) => t.segmentId === "T0001")!;
    expect(t0001.repeticiones).toBe(2);
    expect(t0001.esPasoActual).toBe(true);
    expect(vm.tramos.find((t) => t.segmentId === "T0002")!.repeticiones).toBe(1);
    const transit = vm.tramos.find((t) => t.segmentId === "T0003")!;
    expect(transit.esTransito).toBe(true);
    expect(transit.esDestino).toBe(false);
    expect(transit.ordenes).toEqual([3]);
    expect(t0001.ordenes).toEqual([0, 2]);
  });

  it("resumen textual menciona repetidos y no depende del mapa", () => {
    const vm = toMapViewModel({ tramos: scenarioFixture.segments, nodos, prioridades, pasos });
    expect(vm.resumen).toContain("4 pasos");
    expect(vm.resumen).toContain("T0001×2");
  });

  it("sin recorrido: resumen vacío explícito", () => {
    const vm = toMapViewModel({ tramos: scenarioFixture.segments, nodos, prioridades, pasos: [] });
    expect(vm.resumen).toBe("Sin recorrido.");
  });
});
