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

test("carga <1 s: sin feedback visual, pasa directo a resultados", async ({
  page,
}) => {
  await stubSearchRoute(page, { delayMs: 300 });
  await blockMapTiles(page);
  await search(page);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("Buscando…")).toHaveCount(0);
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible({
    timeout: 15_000,
  });
});

test("carga 1–4 s: muestra spinner y luego resultados", async ({ page }) => {
  await stubSearchRoute(page, { delayMs: 2500 });
  await blockMapTiles(page);
  await search(page);
  await expect(page.getByText("Buscando…")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible({
    timeout: 15_000,
  });
});

test("carga >4 s: muestra progreso con % y cuánto falta, y termina en resultados", async ({
  page,
}) => {
  await stubSearchRoute(page, { delayMs: 6500 });
  await blockMapTiles(page);
  await search(page);
  const bar = page.getByRole("progressbar", { name: "Buscando…" });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  const now = Number(await bar.getAttribute("aria-valuenow"));
  expect(now).toBeGreaterThan(0);
  expect(now).toBeLessThan(100);
  await expect(page.getByText(/Falta \d+%$/)).toBeVisible();
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible({
    timeout: 15_000,
  });
  await expect(bar).toHaveCount(0, { timeout: 15_000 });
});
