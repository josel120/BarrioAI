import { test, expect } from "@playwright/test";
import { trackPageErrors } from "./helpers";

test("home renders shell and search entry points", async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Lo que vende tu barrio, a un toque" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Buscar en tu barrio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Principal" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "BarrioAI" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("suggestion deep-link prefills buscar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ceviche" }).click();
  await expect(page).toHaveURL(/\/buscar\?q=Ceviche/);
  await expect(
    page.getByRole("searchbox", { name: "¿Qué buscas?" }),
  ).toHaveValue("Ceviche");
});
