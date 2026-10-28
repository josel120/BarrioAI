import { test, expect } from "@playwright/test";
import { blockMapTiles, stubSearchRoute } from "./helpers";

test.use({
  geolocation: { latitude: -12.0875, longitude: -77.085 },
  permissions: ["geolocation"],
});

async function search(page: import("@playwright/test").Page) {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  const input = page.getByRole("searchbox", { name: "¿Qué buscas?" });
  await input.fill("tacos al pastor");
  const button = page.getByRole("button", { name: "Buscar", exact: true });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.click();
}

test("carga rapida: pasa a resultados sin barra de progreso", async ({ page }) => {
  await stubSearchRoute(page, { delayMs: 300 });
  await blockMapTiles(page);
  await search(page);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible({ timeout: 15_000 });
});

test("carga lenta: muestra solo el skeleton, sin spinner ni porcentaje", async ({ page }) => {
  await stubSearchRoute(page, { delayMs: 3500 });
  await blockMapTiles(page);
  await search(page);
  await expect(page.locator('[aria-label="Cargando resultados…"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText(/Falta \d+%$/)).toHaveCount(0);
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[aria-label="Cargando resultados…"]')).toHaveCount(0);
});
