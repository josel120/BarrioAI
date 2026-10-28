import { expect, type Page } from "@playwright/test";
import { SEARCH_ROWS } from "./search-rows";

/**
 * Intercepts POST /api/search with fixture rows (no backend keys needed).
 * Returns a hit counter proving the app actually called the stubbed endpoint.
 */
export async function stubSearchRoute(
  page: Page,
  options?: { delayMs?: number },
): Promise<{ hits: () => number }> {
  let count = 0;
  await page.route("**/api/search", async (route) => {
    count += 1;
    if (options?.delayMs) {
      await new Promise((r) => setTimeout(r, options.delayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: SEARCH_ROWS,
        count: SEARCH_ROWS.length,
      }),
    });
  });
  return { hits: () => count };
}

/** Records real /api/search request/response pairs (stubbed or live). */
export function watchApiSearch(page: Page): string[] {
  const log: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/search")) {
      log.push(
        `${response.request().method()} ${response.url()} -> ${response.status()}`,
      );
    }
  });
  return log;
}

export interface ExpectedMap {
  storeName: string;
  productName: string;
  priceText: string;
  distanceText: string;
  extrasText: string;
  /** Prefix of the wa.me deep link (phone + ?text=). */
  waHrefPrefix: string;
}

/**
 * Asserts the MapSearch contract: one pin per store, popup with product,
 * price, distance, extras count, and a correct WhatsApp order link.
 */
export async function assertMapResults(
  page: Page,
  expected: ExpectedMap,
): Promise<void> {
  await expect(page.getByLabel("Mapa de tiendas cercanas")).toBeVisible();
  const pins = page.locator(".barrio-pin");
  await expect(pins).toHaveCount(2);
  await pins.first().click();
  const popup = page.locator("[data-tile]");
  await expect(popup.getByText(expected.storeName)).toBeVisible();
  await expect(popup.getByText(expected.productName)).toBeVisible();
  await expect(popup.getByText(expected.priceText)).toBeVisible();
  await expect(popup.getByText(expected.distanceText)).toBeVisible();
  await expect(popup.getByText(expected.extrasText)).toBeVisible();
  const wa = popup.getByRole("link", { name: "Pedir por WhatsApp" });
  await expect(wa).toBeVisible();
  const href = await wa.getAttribute("href");
  expect(href?.startsWith(expected.waHrefPrefix)).toBe(true);
}

/** Blocks OSM tile images so map tests are hermetic and never wait on them. */
export async function blockMapTiles(page: Page): Promise<void> {
  await page.route("**/tile.openstreetmap.org/**", async (route) => {
    await route.abort();
  });
}

/** Cierra el tile del mapa con su boton, liberando los pines cubiertos. */
export async function closeMapPopup(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Cerrar detalle de/ }).click();
  await expect(page.locator("[data-tile]")).toHaveCount(0);
}

/** Collects window errors; assert the returned array is empty at test end. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}
