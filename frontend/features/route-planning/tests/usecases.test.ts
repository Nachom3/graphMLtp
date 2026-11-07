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
import type { ErrorOperacion, PlanInput } from "../domain/types";
import {
  comparacionFixture,
  costoFixture,
  escenarioFixture,
  filasEntrenamientoFixture,
  planInputFixture,
  prioridadesFixture,
  recorridoRepetidoIds,
} from "./fixtures";

function gw(falla: ErrorOperacion | null = null, latenciaMs = 0, ordenForzado?: string[]) {
  return new FakeGateway(prioridadesFixture, costoFixture, {
    latenciaMs,
    falla,
    ordenForzado,
  });
}

describe("salud y escenario", () => {
  it("salud v1 compatible", async () => {
    const res = await verificarSalud(gw(), new RequestStore());
    expect(res.estado).toBe("exito");
  });

  it("cargar escenario: grafo, datos y metadatos consistentes", () => {
    const res = cargarEscenario(new RequestStore(), escenarioFixture);
    expect(res.estado).toBe("exito");
  });

  it("escenario con versión distinta → error version-incompatible", () => {
    const res = cargarEscenario(new RequestStore(), { ...escenarioFixture, version: "v9" });
    expect(res).toMatchObject({ estado: "error" });
    if (res.estado === "error") expect(res.error.codigo).toBe("version-incompatible");
  });

  it("escenario con FK rota → error", () => {
    const roto = {
      ...escenarioFixture,
      tramos: [{ ...escenarioFixture.tramos[0], nodoDestino: "N-XXX" }],
    };
    const res = cargarEscenario(new RequestStore(), roto);
    expect(res.estado).toBe("error");
  });
});

describe("comparación: resultados ya calculados, sin HTTP", () => {
  it("presenta métricas, baseline y configuración", () => {
    const res = consultarComparacion(new RequestStore(), comparacionFixture);
    expect(res.estado).toBe("exito");
    if (res.estado !== "exito") return;
    expect(res.datos.baseline.length).toBeGreaterThan(0);
    expect(Object.keys(res.datos.metricasPorModelo).length).toBeGreaterThanOrEqual(2);
  });
});

describe("prioridades y recorrido con gateway fake (semántica api-v1)", () => {
  it("solicitar prioridades: selección válida → prioridades 1:1 por tramo_id", async () => {
    const res = await solicitarPrioridades(
      gw(),
      new RequestStore(),
      "arbol",
      [escenarioFixture.tramos[0], escenarioFixture.tramos[1]],
      undefined,
      filasEntrenamientoFixture,
    );
    expect(res.estado).toBe("exito");
    if (res.estado !== "exito") return;
    expect(res.datos).toEqual([
      { tramoId: "T0001", prioridad: "baja" },
      { tramoId: "T0002", prioridad: "alta" },
    ]);
  });

  it("modelo no soportado → error backend con detalle", async () => {
    const res = await solicitarPrioridades(
      gw(),
      new RequestStore(),
      "inexistente" as never,
      [escenarioFixture.tramos[0]],
    );
    expect(res.estado).toBe("error");
  });

  it("selección vacía → estado vacío, sin llamar al backend", async () => {
    const resP = await solicitarPrioridades(gw(), new RequestStore(), "arbol", []);
    expect(resP.estado).toBe("vacio");
    const vacio: PlanInput = { ...planInputFixture, tramos: [] };
    const resR = await solicitarRecorrido(gw(), new RequestStore(), vacio);
    expect(resR.estado).toBe("vacio");
  });

  it("tramo desconocido → error tipado", async () => {
    const fantasma = { ...escenarioFixture.tramos[0], tramoId: "T9999" };
    const res = await solicitarPrioridades(gw(), new RequestStore(), "arbol", [fantasma]);
    expect(res.estado).toBe("error");
    if (res.estado !== "error") return;
    expect(res.error.codigo).toBe("tramo-desconocido");
  });

  it("recorrido imposible (falla del backend) → error tipado", async () => {
    const malo = gw({ codigo: "recorrido-imposible" });
    const res = await solicitarRecorrido(malo, new RequestStore(), planInputFixture);
    expect(res.estado).toBe("error");
    if (res.estado !== "error") return;
    expect(res.error.codigo).toBe("recorrido-imposible");
  });

  it("recorrido con tramo repetido conserva ambas ocurrencias y su orden; costo opaco sin recalcular", async () => {
    const orden = gw(null, 0, recorridoRepetidoIds);
    const res = await solicitarRecorrido(orden, new RequestStore(), planInputFixture);
    expect(res.estado).toBe("exito");
    if (res.estado !== "exito") return;
    expect(res.datos.pasos.map((p) => p.tramoId)).toEqual(recorridoRepetidoIds);
    expect(res.datos.pasos.filter((p) => p.tramoId === "T0001")).toHaveLength(2);
    expect(res.datos.pasos[2]).toMatchObject({ tramoId: "T0001", repetido: true });
    // Costo: se presenta tal cual (costo_total_m), no se deriva de longitudes.
    expect(res.datos.costo).toEqual(costoFixture);
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
