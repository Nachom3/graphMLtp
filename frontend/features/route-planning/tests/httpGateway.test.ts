import { describe, expect, it, vi, afterEach } from "vitest";
import { crearHttpGateway } from "../infrastructure/httpGateway";
import { escenarioFixture, planInputFixture } from "./fixtures";

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

  it("predecir mapea predicciones 1:1 por tramo_id", async () => {
    mockFetchOnce((url, init) => {
      expect(url).toContain("/predicciones:predecir");
      const body = JSON.parse(String(init?.body));
      expect(body.modelo_id).toBe("arbol");
      expect(body.tramos).toHaveLength(1);
      return jsonRes({
        modelo_id: "arbol",
        predicciones: [{ tramo_id: "R-101", prioridad: "baja" }],
      });
    });
    const gw = crearHttpGateway("http://test");
    const res = await gw.predecirPrioridades("arbol", [escenarioFixture.tramos[0]]);
    expect(res).toEqual([{ tramoId: "R-101", prioridad: "baja" }]);
  });

  it("planificar conserva orden y repeticiones; costo_total_m opaco", async () => {
    mockFetchOnce((url) => {
      expect(url).toContain("/recorridos:planificar");
      return jsonRes({
        orden: ["R-101", "R-102", "R-101"],
        repeticiones: ["R-101"],
        costo_total_m: 301.8,
        unidad: "metros",
      });
    });
    const gw = crearHttpGateway("http://test");
    const r = await gw.planificarRecorrido(planInputFixture);
    expect(r.pasos.map((p) => p.tramoId)).toEqual(["R-101", "R-102", "R-101"]);
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
