import { describe, expect, it } from "vitest";
import {
  RequestStore,
  cargarEscenario,
  consultarComparacion,
  ejecutar,
  solicitarPrioridades,
  solicitarRecorrido,
  verificarSalud,
} from "../application/usecases";
import { FakeGateway } from "../infrastructure/fakeGateway";
import type { OperationError } from "../domain/types";
import {
  comparisonFixture,
  costFixture,
  repeatedRouteIds,
  planInputFixture,
  prioritiesFixture,
  scenarioFixture,
} from "./fixtures";

function gw(failure: OperationError | null = null, latencyMs = 0, forcedOrder?: string[]) {
  return new FakeGateway(prioritiesFixture, costFixture, {
    latencyMs,
    failure,
    forcedOrder,
  });
}

describe("salud y escenario", () => {
  it("salud v1 compatible", async () => {
    const res = await verificarSalud(gw(), new RequestStore());
    expect(res.estado).toBe("exito");
  });

  it("cargar escenario: grafo, datos y metadatos consistentes", () => {
    const res = cargarEscenario(new RequestStore(), scenarioFixture);
    expect(res.estado).toBe("exito");
  });

  it("escenario con versión distinta → error version-mismatch", () => {
    const res = cargarEscenario(new RequestStore(), { ...scenarioFixture, version: "v9" });
    expect(res).toMatchObject({ estado: "error" });
    if (res.estado === "error") expect(res.error.code).toBe("version-mismatch");
  });

  it("escenario con FK rota → error", () => {
    const roto = {
      ...scenarioFixture,
      segments: [{ ...scenarioFixture.segments[0], destinationNode: "N-XXX" }],
    };
    const res = cargarEscenario(new RequestStore(), roto);
    expect(res.estado).toBe("error");
  });
});

describe("comparación: resultados ya calculados, sin HTTP", () => {
  it("presenta métricas, baseline y mejor por CV (forma del backend)", () => {
    const res = consultarComparacion(new RequestStore(), comparisonFixture);
    expect(res.estado).toBe("exito");
    if (res.estado !== "exito") return;
    expect(res.datos.baselineAccuracy).toBeGreaterThan(0);
    expect(res.datos.metrics.length).toBeGreaterThanOrEqual(2);
    expect(res.datos.bestByCv.length).toBeGreaterThan(0);
    expect(res.datos.metrics[0].confusionMatrix.length).toBe(3);
  });
});

describe("prioridades y recorrido con gateway fake (semántica del backend)", () => {
  it("solicitar prioridades: selección válida → prioridades 1:1 por segment_id", async () => {
    const res = await solicitarPrioridades(
      gw(),
      new RequestStore(),
      "arbol",
      [scenarioFixture.segments[0], scenarioFixture.segments[1]],
    );
    expect(res.estado).toBe("exito");
    if (res.estado !== "exito") return;
    expect(res.datos).toEqual([
      { segmentId: "T0001", priority: "low" },
      { segmentId: "T0002", priority: "high" },
    ]);
  });

  it("modelo no soportado → error backend con detalle", async () => {
    const res = await solicitarPrioridades(
      gw(),
      new RequestStore(),
      "inexistente" as never,
      [scenarioFixture.segments[0]],
    );
    expect(res.estado).toBe("error");
  });

  it("selección vacía → estado vacío, sin llamar al backend", async () => {
    const resP = await solicitarPrioridades(gw(), new RequestStore(), "arbol", []);
    expect(resP.estado).toBe("vacio");
    const vacio = { ...planInputFixture, startNodeId: "N0001", segments: [] };
    const resR = await solicitarRecorrido(gw(), new RequestStore(), vacio);
    expect(resR.estado).toBe("vacio");
  });

  it("tramo desconocido → error tipado", async () => {
    const fantasma = { ...scenarioFixture.segments[0], segmentId: "T9999" };
    const res = await solicitarPrioridades(gw(), new RequestStore(), "arbol", [fantasma]);
    expect(res.estado).toBe("error");
    if (res.estado !== "error") return;
    expect(res.error.code).toBe("prediction-without-segment");
  });

  it("recorrido imposible (falla del backend) → error tipado", async () => {
    const malo = gw({ code: "impossible-route" });
    const res = await solicitarRecorrido(malo, new RequestStore(), { ...planInputFixture, startNodeId: "N0001" });
    expect(res.estado).toBe("error");
    if (res.estado !== "error") return;
    expect(res.error.code).toBe("impossible-route");
  });

  it("recorrido con tramo repetido conserva ambas ocurrencias y su orden; costo opaco sin recalcular", async () => {
    const orden = gw(null, 0, repeatedRouteIds);
    const res = await solicitarRecorrido(orden, new RequestStore(), { ...planInputFixture, startNodeId: "N0001" });
    expect(res.estado).toBe("exito");
    if (res.estado !== "exito") return;
    expect(res.datos.steps.map((p) => p.segmentId)).toEqual(repeatedRouteIds);
    expect(res.datos.steps.filter((p) => p.segmentId === "T0001")).toHaveLength(2);
    expect(res.datos.steps[2]).toMatchObject({ segmentId: "T0001", repeated: true });
    // Costo: se presenta tal cual (total_cost_m), no se deriva de longitudes.
    expect(res.datos.cost).toEqual(costFixture);
  });

  it("respuesta tardía no reemplaza el resultado vigente", async () => {
    const store = new RequestStore();
    const lenta = new Promise<string>((r) => setTimeout(() => r("vieja"), 30));
    const rapida = new Promise<string>((r) => setTimeout(() => r("nueva"), 5));
    const [pVieja, pNueva] = [
      ejecutar(store, lenta, () => null),
      ejecutar(store, rapida, () => null),
    ];
    const [rVieja, rNueva] = [await pVieja, await pNueva];
    expect(rNueva.estado).toBe("exito");
    if (rNueva.estado === "exito") expect(rNueva.datos).toBe("nueva");
    expect(rVieja.estado).not.toBe("exito");
  });
});
