import { describe, expect, it, vi, afterEach } from "vitest";
import { crearHttpGateway } from "../infrastructure/httpGateway";
import { planInputFixture, scenarioFixture } from "./fixtures";

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

describe("httpGateway: backend en inglés, único lugar con fetch", () => {
  it("health devuelve status, versión y esquema", async () => {
    mockFetchOnce((url) => {
      expect(url).toContain("/health");
      return jsonRes({ status: "ok", version: "v1", schema: "v1" });
    });
    const gw = crearHttpGateway("http://test");
    await expect(gw.health()).resolves.toEqual({ status: "ok", version: "v1", schema: "v1" });
  });

  it("predecir envía segmentos sin filas de entrenamiento", async () => {
    mockFetchOnce((url, init) => {
      expect(url).toContain("/predictions:predict");
      const body = JSON.parse(String(init?.body));
      expect(body.model_id).toBe("arbol");
      expect(body).not.toHaveProperty("training_rows");
      expect(body.segments).toHaveLength(1);
      expect(body.segments[0]).toMatchObject({ segment_id: "T0001", zone_type: "residential" });
      return jsonRes({
        model_id: "arbol",
        predictions: [{ segment_id: "T0001", priority: "low" }],
      });
    });
    const gw = crearHttpGateway("http://test");
    const res = await gw.predictPriorities("arbol", [scenarioFixture.segments[0]]);
    expect(res).toEqual([{ segmentId: "T0001", priority: "low" }]);
  });

  it("rule-v1 funciona sin filas (arreglo vacío)", async () => {
    mockFetchOnce((_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model_id).toBe("rule-v1");
      expect(body).not.toHaveProperty("training_rows");
      return jsonRes({
        model_id: "rule-v1",
        predictions: [{ segment_id: "T0001", priority: "low" }],
      });
    });
    const gw = crearHttpGateway("http://test");
    const res = await gw.predictPriorities("rule-v1", [scenarioFixture.segments[0]]);
    expect(res).toEqual([{ segmentId: "T0001", priority: "low" }]);
  });

  it("planificar conserva orden y repeticiones; total_cost_m opaco", async () => {
    mockFetchOnce((url, init) => {
      expect(url).toContain("/routes:plan");
      const body = JSON.parse(String(init?.body));
      expect(body.include).toEqual(["medium", "high"]);
      expect(body.start_node_id).toBe("N0001");
      return jsonRes({
        order: ["T0001", "T0002", "T0001"],
        repetitions: ["T0001"],
        total_cost_m: 301.8,
        unit: "meters",
        mandatory: ["T0001", "T0002"],
        transit: ["T0003"],
        repeated_distance_m: 85.5,
        coverage: 1,
      });
    });
    const gw = crearHttpGateway("http://test");
    const r = await gw.planRoute({ ...planInputFixture, startNodeId: "N0001" });
    expect(r.steps.map((p) => p.segmentId)).toEqual(["T0001", "T0002", "T0001"]);
    expect(r.steps[2]).toMatchObject({ repeated: true });
    expect(r.cost).toEqual({
      totalCostM: 301.8,
      unit: "meters",
      mandatory: ["T0001", "T0002"],
      transit: ["T0003"],
      repeatedDistanceM: 85.5,
      coverage: 1,
    });
  });

  it("IMPOSSIBLE_ROUTE y PREDICTION_WITHOUT_SEGMENT se mapean; red → network", async () => {
    const gw = crearHttpGateway("http://test");
    mockFetchOnce(() => jsonRes({ detail: { code: "IMPOSSIBLE_ROUTE" } }, 422));
    await expect(gw.planRoute({ ...planInputFixture, startNodeId: "N0001" })).rejects.toMatchObject({
      code: "impossible-route",
    });
    mockFetchOnce(() => jsonRes({ detail: { code: "PREDICTION_WITHOUT_SEGMENT", detail: "x" } }, 422));
    await expect(gw.predictPriorities("arbol", [scenarioFixture.segments[0]])).rejects.toMatchObject(
      { code: "prediction-without-segment" },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("down");
      }),
    );
    await expect(gw.health()).rejects.toMatchObject({ code: "network" });
  });
});
