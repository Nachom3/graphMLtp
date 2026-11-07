import { describe, expect, it, vi, afterEach } from "vitest";
import { crearHttpGateway } from "../infrastructure/httpGateway";
import { escenarioFixture, filasEntrenamientoFixture, planInputFixture } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => handler(url, init)),
  );
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("httpGateway: api-v1, único lugar con fetch", () => {
  it("salud devuelve versión y esquema", async () => {
    mockFetchOnce((url) => {
      expect(url).toContain("/salud");
      return jsonRes({ estado: "ok", version: "v1", esquema: "v1" });
    });
    const gw = crearHttpGateway("http://test");
    await expect(gw.salud()).resolves.toEqual({ estado: "ok", version: "v1", esquema: "v1" });
  });

  it("predecir envía filas_entrenamiento (api-v1 la exige para arbol/logistica)", async () => {
    mockFetchOnce((url, init) => {
      expect(url).toContain("/predicciones:predecir");
      const body = JSON.parse(String(init?.body));
      expect(body.modelo_id).toBe("arbol");
      expect(body.filas_entrenamiento).toEqual([
        {
          tipo_zona: "residencial",
          cantidad_contenedores: 1,
          dias_desde_ultima_recoleccion: 2,
          historico_quejas_vecinales: 0,
          prioridad_recoleccion: "baja",
        },
        {
          tipo_zona: "comercial",
          cantidad_contenedores: 2,
          dias_desde_ultima_recoleccion: 4,
          historico_quejas_vecinales: 2,
          prioridad_recoleccion: "alta",
        },
      ]);
      expect(body.tramos).toHaveLength(1);
      return jsonRes({
        modelo_id: "arbol",
        predicciones: [{ tramo_id: "T0001", prioridad: "baja" }],
      });
    });
    const gw = crearHttpGateway("http://test");
    const res = await gw.predecirPrioridades(
      "arbol",
      [escenarioFixture.tramos[0]],
      undefined,
      filasEntrenamientoFixture,
    );
    expect(res).toEqual([{ tramoId: "T0001", prioridad: "baja" }]);
  });

  it("regla-v1 funciona sin filas (arreglo vacío)", async () => {
    mockFetchOnce((url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.modelo_id).toBe("regla-v1");
      expect(body.filas_entrenamiento).toEqual([]);
      return jsonRes({
        modelo_id: "regla-v1",
        predicciones: [{ tramo_id: "T0001", prioridad: "baja" }],
      });
    });
    const gw = crearHttpGateway("http://test");
    const res = await gw.predecirPrioridades("regla-v1", [escenarioFixture.tramos[0]]);
    expect(res).toEqual([{ tramoId: "T0001", prioridad: "baja" }]);
  });

  it("planificar conserva orden y repeticiones; costo_total_m opaco", async () => {
    mockFetchOnce((url) => {
      expect(url).toContain("/recorridos:planificar");
      return jsonRes({
        orden: ["T0001", "T0002", "T0001"],
        repeticiones: ["T0001"],
        costo_total_m: 301.8,
        unidad: "metros",
      });
    });
    const gw = crearHttpGateway("http://test");
    const r = await gw.planificarRecorrido(planInputFixture);
    expect(r.pasos.map((p) => p.tramoId)).toEqual(["T0001", "T0002", "T0001"]);
    expect(r.pasos[2]).toMatchObject({ repetido: true });
    expect(r.costo).toEqual({ valor: 301.8, unidad: "metros" });
  });

  it("RECORRIDO_IMPOSIBLE y PREDICCION_SIN_TRAMO se mapean; red → red", async () => {
    const gw = crearHttpGateway("http://test");
    mockFetchOnce(() => jsonRes({ detail: { codigo: "RECORRIDO_IMPOSIBLE" } }, 422));
    await expect(gw.planificarRecorrido(planInputFixture)).rejects.toMatchObject({
      codigo: "recorrido-imposible",
    });
    mockFetchOnce(() => jsonRes({ detail: { codigo: "PREDICCION_SIN_TRAMO", detalle: "x" } }, 422));
    await expect(gw.predecirPrioridades("arbol", [escenarioFixture.tramos[0]])).rejects.toMatchObject(
      { codigo: "tramo-desconocido" },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("down");
      }),
    );
    await expect(gw.salud()).rejects.toMatchObject({ codigo: "red" });
  });
});
