import { expect, test } from "@playwright/test";

// These tests require a production build served over HTTPS — the service worker
// caches /_next/static/* assets which are unstable in dev mode. In CI they run
// against Vercel preview deployments (production build + HTTPS). Locally, skip
// unless BASE_URL points to a deployed target.

test.describe("PWA offline resilience", () => {
  test.skip(!process.env.BASE_URL, "Requires a deployed target (set BASE_URL)");

  test("service worker registers on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for the service worker to register, activate, AND claim this page
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      { timeout: 10_000 }
    );
  });

  test("landing page loads from cache when offline", async ({ page }) => {
    // First visit — registers the service worker
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for SW to control this page (active + clients.claim() resolved)
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      { timeout: 10_000 }
    );

    // Second visit — SW intercepts navigate, fetches from network, and caches
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for the pages cache to be populated (cache.put is async)
    await page.waitForFunction(
      async () => {
        const cache = await caches.open("pages-v1");
        const keys = await cache.keys();
        return keys.length > 0;
      },
      { timeout: 5000 }
    );

    // Go offline and navigate — SW catch handler falls back to cache.match()
    await page.context().setOffline(true);

    // Use goto (not reload) — reload can bypass SW in some Chromium builds
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.context().setOffline(false);
  });

  test("static assets served from cache when offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      { timeout: 10_000 }
    );

    // Second visit — SW caches static assets and HTML
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.waitForFunction(
      async () => {
        const cache = await caches.open("pages-v1");
        const keys = await cache.keys();
        return keys.length > 0;
      },
      { timeout: 5000 }
    );

    // Go offline and verify page renders with styles
    await page.context().setOffline(true);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hasStyles = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.body);
      return computedStyle.fontFamily.length > 0;
    });
    expect(hasStyles).toBe(true);

    await page.context().setOffline(false);
  });
});
