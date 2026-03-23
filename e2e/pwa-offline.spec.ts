import { expect, type Page, test } from "@playwright/test";

// These tests require a production build served over HTTPS — the service worker
// caches /_next/static/* assets which are unstable in dev mode. In CI they run
// against Vercel preview deployments (production build + HTTPS). Locally, skip
// unless BASE_URL points to a deployed target.

/** Wait for the service worker to activate, claim the page, and be the controller. */
async function waitForSwController(page: Page) {
  await page.waitForFunction(
    async () => {
      // First check: SW must be in the "activated" state (not null)
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active) {
        return false;
      }

      // Second check: SW must control this page (clients.claim() completed)
      // On the very first load the controller is null even after activation.
      // A reload through the active SW makes it the controller.
      return navigator.serviceWorker.controller !== null;
    },
    { timeout: 15_000 }
  );
}

test.describe("PWA offline resilience", () => {
  test.skip(!process.env.BASE_URL, "Requires a deployed target (set BASE_URL)");

  test("service worker registers on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // SW activates via skipWaiting + clients.claim — controller may need a reload
    const isController = await page.evaluate(
      () => navigator.serviceWorker.controller !== null
    );
    if (!isController) {
      // Reload so the active SW becomes the controller for the new navigation
      await page.reload();
    }

    await waitForSwController(page);
  });

  test("landing page loads from cache when offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    const isController = await page.evaluate(
      () => navigator.serviceWorker.controller !== null
    );
    if (!isController) {
      await page.reload();
    }
    await waitForSwController(page);

    // Navigate again so the SW's fetch handler caches the page (network-first)
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for cache.put() to complete (async inside the SW fetch handler)
    await page.waitForFunction(
      async () => {
        const cache = await caches.open("pages-v1");
        const keys = await cache.keys();
        return keys.length > 0;
      },
      { timeout: 5000 }
    );

    // Go offline — SW catch handler falls back to cache.match()
    await page.context().setOffline(true);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.context().setOffline(false);
  });

  test("static assets served from cache when offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    const isController = await page.evaluate(
      () => navigator.serviceWorker.controller !== null
    );
    if (!isController) {
      await page.reload();
    }
    await waitForSwController(page);

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
