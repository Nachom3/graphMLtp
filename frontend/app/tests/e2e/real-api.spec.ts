import { expect, test } from "@playwright/test";

type Scenario = {
  nodes: { node_id: string; lon: number; lat: number }[];
  segments: {
    segment_id: string;
    origin_node: string;
    destination_node: string;
    length_m: number;
    zone_type: "residential" | "commercial" | "industrial";
    container_count: number;
    days_since_last_collection: number;
    historic_neighbor_complaints: number;
  }[];
};

type Prediction = { segment_id: string; priority: "low" | "medium" | "high" };
type Route = {
  order: string[];
  repetitions: string[];
  total_cost_m: number;
  unit: string;
  mandatory: string[];
  transit: string[];
  repeated_distance_m: number;
  coverage: number;
};

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

test("la demo presenta circuito y estadísticas de la API v1 real", async ({ page, request }) => {
  // El test no necesita teselas externas: valida interacción y datos accesibles.
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());

  const healthResponse = await request.get(`${api}/health`);
  expect(healthResponse.ok(), "la API real debe estar levantada").toBeTruthy();
  expect(await healthResponse.json()).toMatchObject({ status: "ok", version: "v1", schema: "v1" });

  const scenarioResponse = await request.get(`${api}/scenario`);
  expect(scenarioResponse.ok()).toBeTruthy();
  const scenario = (await scenarioResponse.json()) as Scenario;
  expect(scenario.segments.some((segment) => segment.container_count === 0)).toBe(true);

  const predictionResponse = await request.post(`${api}/predictions:predict`, {
    data: { model_id: "arbol", segments: scenario.segments },
  });
  expect(predictionResponse.ok(), "la API debe tener disponible el árbol ajustado").toBeTruthy();
  const predictions = ((await predictionResponse.json()) as { predictions: Prediction[] }).predictions;
  expect(predictions).toHaveLength(scenario.segments.length);

  const priorities = Object.fromEntries(predictions.map(({ segment_id, priority }) => [segment_id, priority]));
  const include = ["high", "medium"];
  const startNodeId = scenario.nodes[0].node_id;
  const expectedResponse = await request.post(`${api}/routes:plan`, {
    data: {
      nodes: scenario.nodes,
      segments: scenario.segments,
      priorities,
      include,
      start_node_id: startNodeId,
    },
  });
  expect(expectedResponse.ok()).toBeTruthy();
  const expected = (await expectedResponse.json()) as Route;
  expect(Array.isArray(expected.transit)).toBe(true);
  expect(expected.transit.every((id) => scenario.segments.find((s) => s.segment_id === id)?.container_count === 0)).toBe(true);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planificá un circuito de recolección" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("prioridades calculadas por el árbol");
  await expect(page.getByRole("heading", { name: "1. Escenario piloto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Elegí prioridades y nodo de inicio" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue(startNodeId);

  await page.getByRole("button", { name: "Solicitar circuito" }).click();
  await expect(page.getByRole("heading", { name: "3. Circuito devuelto por la API" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leyenda de prioridades" })).toBeVisible();
  await expect(page.getByText("Alta — línea gruesa sólida")).toBeVisible();
  await expect(page.getByText("Media — línea media rayada")).toBeVisible();
  await expect(page.getByText("Baja — línea fina punteada")).toBeVisible();
  await expect(page.getByText("Conexión de tránsito — gris discontinua; no es una recolección")).toBeVisible();

  const summary = page.getByRole("region", { name: "3. Circuito devuelto por la API" });
  await expect(summary).toContainText(`distancia total ${expected.total_cost_m} ${expected.unit}`);
  await expect(summary).toContainText(`Distancia en tramos repetidos: ${expected.repeated_distance_m} ${expected.unit}`);
  await expect(summary).toContainText(`Calles obligatorias cubiertas: ${expected.mandatory.length}`);
  await expect(summary).toContainText(`Cobertura: ${(expected.coverage * 100).toLocaleString("es", { maximumFractionDigits: 1 })}%`);
  const renderedSteps = await summary.locator("ol li").allTextContents();
  expect(renderedSteps).toHaveLength(expected.order.length);
  expected.order.forEach((segmentId, index) => expect(renderedSteps[index]).toContain(`tramo ${segmentId}`));
  for (const transitId of expected.transit) {
    await expect(summary).toContainText(`tramo ${transitId}`);
    const row = page.locator("tbody tr").filter({ hasText: transitId });
    await expect(row).toContainText("0");
  }
});
