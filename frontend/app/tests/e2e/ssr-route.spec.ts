import { expect, test } from "@playwright/test";
import { seleccionarAreaVisible } from "../../../features/route-planning/components/map-view/mapViewModel";
import type { Node, Segment } from "../../../features/route-planning/domain/types";

type ApiSegment = {
  segment_id: string;
  origin_node: string;
  destination_node: string;
  length_m: number;
  zone_type: Segment["zoneType"];
  container_count: number;
  days_since_last_collection: number;
  historic_neighbor_complaints: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

type ApiScenario = {
  nodes: { node_id: string; lat: number; lon: number }[];
  segments: ApiSegment[];
};

type ApiRoute = { order: string[]; total_cost_m: number; unit: string };
const api = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

test.describe("recorrido renderizado en servidor", () => {
  // Esta configuración prueba el HTML entregado por Next, no una vista que
  // ejecutó fetch, React o Leaflet en el navegador después de hidratarse.
  test.use({ javaScriptEnabled: false });
  test.setTimeout(120_000);

  test("entrega costo, pasos y geometría del circuito real sin JavaScript", async ({ page, request }) => {
    const scenarioResponse = await request.get(`${api}/scenario`);
    expect(scenarioResponse.ok()).toBeTruthy();
    const scenario = (await scenarioResponse.json()) as ApiScenario;
    const street = scenario.segments.find((segment) =>
      segment.container_count > 0 && segment.geometry?.coordinates.length >= 2,
    );
    expect(street, "se necesita un tramo real con contenedores y geometría").toBeDefined();
    if (!street) throw new Error("El escenario no tiene un tramo con geometría y contenedores");

    // Una ventana pequeña sobre el primer tramo evita pedir un circuito urbano
    // entero; los tramos que la intersectan se incluyen completos.
    const [first, second] = street.geometry.coordinates;
    const lon = (first[0] + second[0]) / 2;
    const lat = (first[1] + second[1]) / 2;
    const bounds = { sur: lat - 0.00001, norte: lat + 0.00001, oeste: lon - 0.00001, este: lon + 0.00001 };
    const nodes: Node[] = scenario.nodes.map((node) => ({ nodeId: node.node_id, lat: node.lat, lon: node.lon }));
    const segments: Segment[] = scenario.segments.map((segment) => ({
      segmentId: segment.segment_id,
      originNode: segment.origin_node,
      destinationNode: segment.destination_node,
      lengthM: segment.length_m,
      zoneType: segment.zone_type,
      containerCount: segment.container_count,
      daysSinceLastCollection: segment.days_since_last_collection,
      historicNeighborComplaints: segment.historic_neighbor_complaints,
      geometry: segment.geometry?.coordinates.map(([x, y]) => [y, x]),
    }));
    const area = seleccionarAreaVisible(nodes, segments, bounds);
    expect(area.tramos.length).toBeGreaterThan(0);
    expect(area.tramos.length).toBeLessThanOrEqual(300);
    expect(area.tramos.map((segment) => segment.segmentId)).toContain(street.segment_id);
    const selectedIds = new Set(area.tramos.map((segment) => segment.segmentId));
    const selectedApiSegments = scenario.segments.filter((segment) => selectedIds.has(segment.segment_id));
    const prediction = await request.post(`${api}/predictions:predict`, {
      data: { model_id: "arbol", segments: selectedApiSegments },
    });
    expect(prediction.ok()).toBeTruthy();
    const predicted = (await prediction.json()) as { predictions: { segment_id: string; priority: string }[] };
    const priorities = Object.fromEntries(predicted.predictions.map(({ segment_id, priority }) => [segment_id, priority]));
    const override = priorities[street.segment_id] === "low" ? "high" : "low";
    priorities[street.segment_id] = override;
    const routeResponse = await request.post(`${api}/routes:plan`, {
      data: {
        nodes: area.nodos.map((node) => ({ node_id: node.nodeId, lon: node.lon, lat: node.lat })),
        segments: selectedApiSegments,
        priorities,
        include: ["high", "medium", "low"],
        start_node_id: street.origin_node,
      },
    });
    expect(routeResponse.ok(), "el área de prueba debe tener un circuito válido").toBeTruthy();
    const expected = (await routeResponse.json()) as ApiRoute;

    const params = new URLSearchParams({
      sur: String(bounds.sur), norte: String(bounds.norte),
      oeste: String(bounds.oeste), este: String(bounds.este),
      include: "high,medium,low", start: street.origin_node,
    });
    params.append("override", `${street.segment_id}:${override}`);
    const response = await page.goto(`/recorrido?${params}`);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Recorrido calculado" })).toBeVisible();
    const map = page.getByRole("img", { name: "Mapa del recorrido renderizado en el servidor" });
    await expect(map).toBeVisible();
    const routeLines = map.locator('polyline[data-route-segment="true"]');
    expect(await routeLines.count()).toBeGreaterThan(0);
    for (const id of new Set(expected.order)) {
      await expect(map.locator(`polyline[data-route-segment="true"][data-segment-id="${id}"]`)).toHaveCount(1);
    }
    await expect(map.locator(`polyline[data-route-segment="true"][data-segment-id="${street.segment_id}"]`))
      .toHaveAttribute("stroke", override === "low" ? "#1d4ed8" : "#b91c1c");
    const formatted = expected.total_cost_m.toLocaleString("es", { maximumFractionDigits: 1 });
    await expect(page.getByText("Distancia total", { exact: true }).locator(".."))
      .toContainText(`${formatted} ${expected.unit === "meters" ? "m" : expected.unit}`);
    const steps = page.locator("ol li");
    await expect(steps).toHaveCount(expected.order.length);
    for (const [index, id] of expected.order.entries()) {
      await expect(steps.nth(index)).toContainText(`Paso ${index + 1}: tramo ${id}`);
    }
  });

  test("parámetros inválidos muestran error y no una ruta ficticia", async ({ page }) => {
    await page.goto("/recorrido?sur=no-es-numero&norte=-34.9&oeste=-56.2&este=-56.1&include=high&start=N1");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recorrido calculado" })).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Mapa del recorrido renderizado en el servidor" })).toHaveCount(0);
  });
});
