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

    // Wait for the service worker to register and activate (async process)
    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) {
          return false;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active !== undefined;
      },
      { timeout: 10_000 }
    );
  });

  test("landing page loads from cache when offline", async ({ page }) => {
    // First visit — registers the service worker
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for SW to activate
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active !== undefined;
      },
      { timeout: 10_000 }
    );

    // Second visit — SW intercepts navigate, fetches from network, and caches
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for the SW to finish writing to the pages cache (cache.put is async)
    await page.waitForFunction(
      async () => {
        const cache = await caches.open("pages-v1");
        const keys = await cache.keys();
        return keys.length > 0;
      },
      { timeout: 5000 }
    );

    // Go offline — SW falls back to cached response on network error
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.context().setOffline(false);
  });

  test("static assets served from cache when offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active !== undefined;
      },
      { timeout: 10_000 }
    );

    // Second visit — SW caches static assets and HTML
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for caches to populate
    await page.waitForFunction(
      async () => {
        const pages = await caches.open("pages-v1");
        const pagesKeys = await pages.keys();
        return pagesKeys.length > 0;
      },
      { timeout: 5000 }
    );

    // Go offline and check that CSS/JS still loads
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });

    const hasStyles = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.body);
      return computedStyle.fontFamily.length > 0;
    });
    expect(hasStyles).toBe(true);

    await page.context().setOffline(false);
  });
});
