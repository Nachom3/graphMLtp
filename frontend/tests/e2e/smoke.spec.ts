import { expect, test } from "@playwright/test";

/** Smoke acotado: la app levanta y la home responde (sin mapa real). */
test("home carga", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Next\.js|Create Next App|Recolecci/i);
});
