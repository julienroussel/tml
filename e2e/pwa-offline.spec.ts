import { expect, type Page, test } from "@playwright/test";

// These tests require a production build served over HTTPS — the service worker
// caches /_next/static/* assets which are unstable in dev mode. In CI they run
// against Vercel preview deployments (production build + HTTPS). Locally, skip
// unless BASE_URL points to a deployed target.

/** Wait for the service worker to activate and control the page. */
async function waitForSwController(page: Page) {
  // Check if SW is already the controller
  const isController = await page.evaluate(
    () => navigator.serviceWorker.controller !== null
  );

  // On first visit, the page loads before the SW activates. Reload so the
  // active SW (with skipWaiting + clients.claim) becomes the controller.
  if (!isController) {
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active != null;
      },
      { timeout: 10_000 }
    );
    await page.reload();
  }

  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    { timeout: 10_000 }
  );
}

test.describe("PWA offline resilience", () => {
  test.skip(!process.env.BASE_URL, "Requires a deployed target (set BASE_URL)");

  test("service worker registers and controls the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
    await waitForSwController(page);
  });

  test("service worker caches pages for offline use", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
    await waitForSwController(page);

    // Navigate again — SW intercepts the fetch, serves from network, and caches
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Verify the pages cache has a response for this URL
    // (Chromium's offline emulation bypasses SW fetch events, so we verify
    // the cache directly instead of simulating an offline navigation.)
    const cacheResult = await page.evaluate(async () => {
      const cache = await caches.open("pages-v1");
      const response = await cache.match(location.href);
      if (!response) {
        return null;
      }
      const text = await response.text();
      return {
        status: response.status,
        hasContent: text.length > 0,
        hasMainContent: text.includes("main-content"),
      };
    });

    expect(cacheResult).not.toBeNull();
    expect(cacheResult?.status).toBe(200);
    expect(cacheResult?.hasContent).toBe(true);
    expect(cacheResult?.hasMainContent).toBe(true);
  });

  test("service worker caches static assets", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
    await waitForSwController(page);

    // Navigate to populate caches
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Verify the static cache has Next.js bundles
    const staticEntries = await page.evaluate(async () => {
      const cache = await caches.open("static-v1");
      const keys = await cache.keys();
      return keys.map((r) => new URL(r.url).pathname);
    });

    // Should have cached /_next/static/* assets (JS bundles, CSS)
    const hasNextStatic = staticEntries.some((p) =>
      p.startsWith("/_next/static/")
    );
    expect(hasNextStatic).toBe(true);
    expect(staticEntries.length).toBeGreaterThan(0);
  });
});
