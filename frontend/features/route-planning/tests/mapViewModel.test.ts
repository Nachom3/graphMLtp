import { describe, expect, it } from "vitest";
import { toMapViewModel } from "../components/map-view/mapViewModel";
import { escenarioFixture, prioridadesFixture, recorridoRepetidoIds } from "./fixtures";
import { conRepeticiones } from "../domain/types";

describe("mapViewModel: puro, sin Leaflet ni DOM", () => {
  const nodos = new Map(escenarioFixture.nodos.map((n) => [n.nodoId, { lat: n.lat, lon: n.lon }]));
  const prioridades = Object.entries(prioridadesFixture).map(([tramoId, prioridad]) => ({
    tramoId,
    prioridad,
  }));
  const pasos = conRepeticiones(recorridoRepetidoIds);

  it("cuenta repeticiones por tramo y marca el paso actual", () => {
    const vm = toMapViewModel({ tramos: escenarioFixture.tramos, nodos, prioridades, pasos, pasoActual: 2 });
    const r101 = vm.tramos.find((t) => t.tramoId === "R-101")!;
    expect(r101.repeticiones).toBe(2);
    expect(r101.esPasoActual).toBe(true);
    expect(vm.tramos.find((t) => t.tramoId === "R-102")!.repeticiones).toBe(1);
  });

  it("resumen textual menciona repetidos y no depende del mapa", () => {
    const vm = toMapViewModel({ tramos: escenarioFixture.tramos, nodos, prioridades, pasos });
    expect(vm.resumen).toContain("4 pasos");
    expect(vm.resumen).toContain("R-101×2");
  });

  it("sin recorrido: resumen vacío explícito", () => {
    const vm = toMapViewModel({ tramos: escenarioFixture.tramos, nodos, prioridades, pasos: [] });
    expect(vm.resumen).toBe("Sin recorrido.");
  });
});
