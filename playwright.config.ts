import { defineConfig } from "@playwright/test";

/**
 * BarrioAI E2E (mobile-first PWA, hence the narrow viewport).
 *
 * - Local: starts `next dev` automatically (webServer) and tests it.
 * - CI: builds and starts production — dev compiles on demand and its
 *   slow hydration races the search specs; production is what ships.
 * - Any environment: set BASE_URL to test a deployed app instead
 *   (e.g. BASE_URL=https://barrioai.vercel.app skips webServer).
 * - Projects: `chromium` (bundled build; CI installs it) and `edge`
 *   (system Microsoft Edge via channel, or PLAYWRIGHT_EDGE_PATH).
 * - The suite stubs POST /api/search, so no API keys are needed to run it.
 */
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PROXY_SERVER = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    viewport: { width: 412, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(PROXY_SERVER
      ? { proxy: { server: PROXY_SERVER, bypass: "127.0.0.1,localhost" } }
      : {}),
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: process.env.CI ? 300_000 : 180_000,
      },
  projects: [
    { name: "chromium" },
    {
      name: "edge",
      use: {
        launchOptions: {
          ...(process.env.PLAYWRIGHT_EDGE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_EDGE_PATH }
            : { channel: "msedge" as const }),
          // Required in locked-down environments (sandboxed CI, restricted users).
          args: ["--no-sandbox", "--disable-crash-reporter"],
        },
      },
    },
  ],
});
