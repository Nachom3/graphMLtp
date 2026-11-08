import { expect, test } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

test("la demo solicita y visualiza un recorrido real del área visible", async ({ page, request }) => {
  test.setTimeout(120_000);
  // Las teselas no son necesarias para comprobar selección, SSR ni resultado.
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  const frontend = test.info().project.use.baseURL;
  if (frontend && !/^http:\/\/(localhost|127\.0\.0\.1):3000\/?$/.test(frontend)) {
    // En un puerto aislado, adaptar exclusivamente CORS: los POST se envían
    // al predictor real; el servidor de SSR llama a la API sin interceptación.
    const origin = new URL(frontend).origin;
    await page.route(`${api}/predictions:predict`, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        } });
        return;
      }
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": origin } });
    });
  }

  const health = await request.get(`${api}/health`);
  expect(health.ok(), "la API real debe estar levantada").toBeTruthy();
  expect(await health.json()).toMatchObject({ status: "ok", version: "v1", schema: "v1" });
  const scenarioResponse = await request.get(`${api}/scenario`);
  expect(scenarioResponse.ok()).toBeTruthy();
  const scenario = (await scenarioResponse.json()) as {
    scenario_id: string;
    segments: { geometry?: { type: string; coordinates: number[][] } | null }[];
  };
  expect(scenario.scenario_id).toBe("montevideo");
  expect(scenario.segments.length).toBeGreaterThan(1000);
  expect(scenario.segments.every((segment) => segment.geometry?.type === "LineString")).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planificá un circuito de recolección" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("prioridades calculadas por el árbol", { timeout: 60_000 });
  const map = page.getByTestId("map-view");
  await expect(map).toBeVisible();
  const boton = page.getByRole("button", { name: "Solicitar circuito" });
  // Control real de Leaflet, sin acceso a refs privadas de React ni mocks de
  // escenario: la zona que se calcula es la que el usuario ve en pantalla.
  for (let i = 0; i < 6 && !(await boton.isEnabled()); i++) {
    await map.locator(".leaflet-control-zoom-in").click();
    await page.waitForTimeout(700);
  }
  await expect(boton).toBeEnabled();
  const inicio = await page.getByLabel("Selector de nodo de inicio").inputValue();
  await boton.click();
  await expect(page).toHaveURL(/\/recorrido\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("start")).toBe(inicio);
  await expect(page.getByRole("heading", { name: "Recorrido calculado" })).toBeVisible({ timeout: 60_000 });
  const result = page.getByRole("img", { name: "Mapa del recorrido renderizado en el servidor" });
  await expect(result).toBeVisible();
  expect(await result.locator('polyline[data-route-segment="true"]').count()).toBeGreaterThan(0);
  expect(await page.locator("ol li").count()).toBeGreaterThan(0);
  await expect(page.getByText("Distancia total", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir mapa interactivo" }).click();
  await expect(page.getByRole("group", { name: "Reproducción del recorrido paso a paso" })).toBeVisible();
});
