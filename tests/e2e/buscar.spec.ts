import { test, expect } from "@playwright/test";
import {
  assertMapResults,
  blockMapTiles,
  closeMapPopup,
  stubSearchRoute,
  trackPageErrors,
  watchApiSearch,
} from "./helpers";

test.use({
  geolocation: { latitude: -12.0875, longitude: -77.085 },
  permissions: ["geolocation"],
});

test("semantic search shows ticket list and map with WhatsApp ordering", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  const apiLog = watchApiSearch(page);
  // 1.6 s: pasa el umbral de 1 s y el spinner ya es observable.
  const searchStub = await stubSearchRoute(page, { delayMs: 1600 });
  await blockMapTiles(page);
  // domcontentloaded: don't wait for map tiles to declare the page loaded.
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });

  const input = page.getByRole("searchbox", { name: "¿Qué buscas?" });
  await expect(input).toBeVisible();
  await input.fill("tacos al pastor");
  // Guard: the typed query must survive hydration (a client-side tree
  // regeneration would wipe it and the search click would silently no-op).
  await expect(input).toHaveValue("tacos al pastor");

  // The button enables once the geolocation hook resolves; fail fast and
  // explicitly here if the browser never provides coordinates.
  const searchButton = page.getByRole("button", {
    name: "Buscar",
    exact: true,
  });
  await expect(searchButton).toBeEnabled({ timeout: 15_000 });
  await searchButton.click();

  // Proves the submit handler ran (before asserting its outcome).
  await expect(page.getByText("Buscando…")).toBeVisible();
  await expect(
    page.locator('[aria-label="Cargando resultados…"]'),
  ).toBeVisible();

  // Either the count line or the error box must settle the search.
  const outcome = page.getByText(/resultados cerca de ti|No pudimos buscar/);
  await expect(outcome).toBeVisible({ timeout: 15_000 });
  const outcomeText = await outcome.textContent();
  console.log(
    `SEARCH_OUTCOME:${outcomeText} stub_hits=${searchStub.hits()} api=${JSON.stringify(apiLog)}`,
  );

  // Ticket list from the stubbed semantic results.
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible();
  await expect(page.getByText("Tacos al pastor").first()).toBeVisible();

  // Map: one pin per store, popup with price/distance/extras/WhatsApp link.
  await assertMapResults(page, {
    storeName: "Taquería La Esquina",
    productName: "Tacos al pastor",
    priceText: "S/ 12.50",
    distanceText: "148 m",
    extrasText: "+1 producto",
    waHrefPrefix: "https://wa.me/51999888777?text=",
  });

  // Store without a phone shows the fallback instead of a link.
  await closeMapPopup(page);
  await page.locator(".barrio-pin").nth(1).click();
  await expect(
    page
      .locator(".leaflet-popup-content")
      .getByText("Esta tienda aún no registra WhatsApp."),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("ticket row expands to store detail with address and WhatsApp", async ({
  page,
}) => {
  const searchStub = await stubSearchRoute(page, { delayMs: 300 });
  await blockMapTiles(page);
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });

  const input = page.getByRole("searchbox", { name: "¿Qué buscas?" });
  await input.fill("tacos al pastor");
  const searchButton = page.getByRole("button", {
    name: "Buscar",
    exact: true,
  });
  await expect(searchButton).toBeEnabled({ timeout: 15_000 });
  await searchButton.click();
  await expect(page.getByText("3 resultados cerca de ti")).toBeVisible({
    timeout: 15_000,
  });
  expect(searchStub.hits()).toBeGreaterThan(0);

  const toggle = page.getByRole("button", {
    name: "Tacos al pastor en Taquería La Esquina: ver detalle",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const detail = page.locator(
    `[id="detalle-11111111-1111-1111-1111-111111111111"]`,
  );
  await expect(detail.getByText("Av. Principal 123")).toBeVisible();
  await expect(detail.getByText("Con piña y cilantro")).toBeVisible();
  await expect(
    detail.getByRole("link", { name: "Pedir por WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/51999888777\?text=/);
});
