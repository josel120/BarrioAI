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
  await input.fill("pollo a la brasa");
  // Guard: the typed query must survive hydration (a client-side tree
  // regeneration would wipe it and the search click would silently no-op).
  await expect(input).toHaveValue("pollo a la brasa");

  // The button enables once the geolocation hook resolves; fail fast and
  // explicitly here if the browser never provides coordinates.
  const searchButton = page.getByRole("button", {
    name: "Buscar",
    exact: true,
  });
  await expect(searchButton).toBeEnabled({ timeout: 15_000 });
  await searchButton.click();

  // Proves the submit handler ran: solo skeleton, sin segundo loading.
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
  await expect(page.getByText("Pollo a la brasa 1/4").first()).toBeVisible();

  // Map: one pin per store, popup with price/distance/extras/WhatsApp link.
  await assertMapResults(page, {
    storeName: "Pollería El Ejemplo (demo)",
    productName: "Pollo a la brasa 1/4",
    priceText: "S/ 18.00",
    distanceText: "148 m",
    extrasText: "+1 producto",
    waHrefPrefix: "https://wa.me/51999111222?text=",
  });

  // Store without a phone shows the fallback instead of a link.
  await closeMapPopup(page);
  await page.locator(".barrio-pin").nth(1).click();
  await expect(
    page
      .locator("[data-tile]")
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
  await input.fill("pollo a la brasa");
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
    name: "Pollo a la brasa 1/4 en Pollería El Ejemplo (demo): ver detalle",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const detail = page.locator(
    `[id="detalle-11111111-1111-1111-1111-111111111111"]`,
  );
  await expect(detail.getByText("Calle Ejemplo 100, Miraflores")).toBeVisible();
  await expect(detail.getByText("Con papas fritas y ensalada")).toBeVisible();
  await expect(
    detail.getByRole("link", { name: "Ver tienda" }),
  ).toBeVisible();
  // WhatsApp se ve sin expandir: es el cierre del golden path.
  await expect(
    page.getByRole("link", { name: "Pedir Pollo a la brasa 1/4 por WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/51999111222\?text=/);
});

test("query de una letra muestra el hint en vez de fallar en silencio", async ({ page }) => {
  await stubSearchRoute(page, { delayMs: 100 });
  await blockMapTiles(page);
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  const input = page.getByRole("searchbox", { name: "¿Qué buscas?" });
  await input.fill("t");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("Escribe al menos 2 letras para buscar.")).toBeVisible();
});
