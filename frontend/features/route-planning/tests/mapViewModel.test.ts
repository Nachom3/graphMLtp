import { describe, expect, it } from "vitest";
import { lineaIntersecaLimites, orientarPasos, puntoMedioEnLinea, seleccionarAreaVisible, toMapViewModel } from "../components/map-view/mapViewModel";
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
      startNodeId: "N0001",
    });
    const t0001 = vm.tramos.find((t) => t.segmentId === "T0001")!;
    expect(t0001.repeticiones).toBe(2);
    expect(t0001.esRepetido).toBe(true);
    expect(t0001.enRecorrido).toBe(true);
    expect(t0001.esPasoActual).toBe(true);
    expect(t0001.yaRecorrido).toBe(true);
    expect(vm.tramos.find((t) => t.segmentId === "T0002")!.yaRecorrido).toBe(true);
    expect(vm.tramos.find((t) => t.segmentId === "T0003")!.yaRecorrido).toBe(false);
    expect(t0001.puntosOrientados?.length).toBe(2);
    expect(vm.tramos.find((t) => t.segmentId === "T0002")!.repeticiones).toBe(1);
    const transit = vm.tramos.find((t) => t.segmentId === "T0003")!;
    expect(transit.esTransito).toBe(true);
    expect(transit.esDestino).toBe(false);
    expect(transit.ordenes).toEqual([3]);
    expect(t0001.ordenes).toEqual([0, 2]);
    expect(vm.hayRecorrido).toBe(true);
    expect(vm.nodos.some((n) => n.esInicio && n.nodeId === "N0001")).toBe(true);
  });

  it("marca yaRecorrido solo con pasos anteriores y lo achica al retroceder", () => {
    const sinEmpezar = toMapViewModel({
      tramos: scenarioFixture.segments,
      nodos,
      prioridades,
      pasos,
      startNodeId: "N0001",
    });
    expect(sinEmpezar.tramos.every((t) => t.yaRecorrido === false)).toBe(true);
    const alFinal = toMapViewModel({
      tramos: scenarioFixture.segments,
      nodos,
      prioridades,
      pasos,
      pasoActual: 3,
      startNodeId: "N0001",
    });
    expect(alFinal.tramos.find((t) => t.segmentId === "T0001")!.yaRecorrido).toBe(true);
    expect(alFinal.tramos.find((t) => t.segmentId === "T0002")!.yaRecorrido).toBe(true);
    const alRetroceder = toMapViewModel({
      tramos: scenarioFixture.segments,
      nodos,
      prioridades,
      pasos,
      pasoActual: 1,
      startNodeId: "N0001",
    });
    expect(alRetroceder.tramos.find((t) => t.segmentId === "T0001")!.yaRecorrido).toBe(true);
    expect(alRetroceder.tramos.find((t) => t.segmentId === "T0002")!.yaRecorrido).toBe(false);
    expect(alRetroceder.tramos.find((t) => t.segmentId === "T0003")!.yaRecorrido).toBe(false);
  });

  it("resumen textual menciona repetidos y no depende del mapa", () => {
    const vm = toMapViewModel({ tramos: scenarioFixture.segments, nodos, prioridades, pasos });
    expect(vm.resumen).toContain("4 pasos");
    expect(vm.resumen).toContain("T0001×2");
  });

  it("sin recorrido: resumen vacío explícito", () => {
    const vm = toMapViewModel({ tramos: scenarioFixture.segments, nodos, prioridades, pasos: [] });
    expect(vm.resumen).toBe("Sin recorrido.");
    expect(vm.hayRecorrido).toBe(false);
  });

  it("orienta el circuito encadenando nodos desde el inicio", () => {
    const orientados = orientarPasos({
      pasos,
      tramos: scenarioFixture.segments,
      nodos,
      startNodeId: "N0001",
    });
    expect(orientados.get(0)?.from).toBe("N0001");
    expect(orientados.get(0)?.to).toBe("N0002");
  });

  it("conserva todos los vértices y revierte la geometría al recorrer de vuelta", () => {
    const curva: [number, number][] = [[-34.915, -56.16], [-34.914, -56.157], [-34.91, -56.155]];
    const tramo = { ...scenarioFixture.segments[0], geometry: curva };
    const pasosIdaVuelta = conRepeticiones([tramo.segmentId, tramo.segmentId]);
    const orientados = orientarPasos({ pasos: pasosIdaVuelta, tramos: [tramo], nodos, startNodeId: tramo.originNode });
    expect(orientados.get(0)?.puntos).toEqual(curva);
    expect(orientados.get(1)?.puntos).toEqual([...curva].reverse());
    expect(curva[0]).toEqual([-34.915, -56.16]);
    const vm = toMapViewModel({ tramos: [tramo], nodos, prioridades, pasos: pasosIdaVuelta, pasoActual: 1, startNodeId: tramo.originNode });
    expect(vm.tramos[0].puntos).toEqual(curva);
    expect(vm.tramos[0].puntosOrientados).toEqual([...curva].reverse());
    expect(vm.tramosSinGeometria).toBe(0);
  });

  it("reconoce rectas de aproximación y posiciona el vehículo sobre la curva", () => {
    const vm = toMapViewModel({ tramos: scenarioFixture.segments, nodos, prioridades, pasos: [] });
    expect(vm.tramosSinGeometria).toBe(scenarioFixture.segments.length);
    const situado = puntoMedioEnLinea([[0, 0], [0, 2], [2, 2]]);
    expect(situado?.punto).toEqual([0, 2]);
    expect(situado?.angulo).toBeCloseTo(0);
    const norte = puntoMedioEnLinea([[0, 0], [2, 0]]);
    expect(norte?.angulo).toBe(-90);
  });

  it("recorta por cruce real de geometría, incluso con extremos fuera de la vista", () => {
    const limites = { sur: -1, norte: 1, oeste: -1, este: 1 };
    expect(lineaIntersecaLimites([[0, -2], [0, 2]], limites)).toBe(true);
    expect(lineaIntersecaLimites([[2, -2], [2, 2]], limites)).toBe(false);
    expect(lineaIntersecaLimites([[-2, -2], [-2, 2], [2, 2]], limites)).toBe(false);
    const tramos = [
      { ...scenarioFixture.segments[0], geometry: [[0, -2], [0, 2]] as [number, number][] },
      { ...scenarioFixture.segments[1], geometry: [[2, -2], [2, 2]] as [number, number][] },
    ];
    const area = seleccionarAreaVisible(scenarioFixture.nodes, tramos, limites);
    expect(area.tramos.map((t) => t.segmentId)).toEqual([tramos[0].segmentId]);
    expect(area.nodos.map((n) => n.nodeId)).toEqual([tramos[0].originNode, tramos[0].destinationNode]);
  });
});
