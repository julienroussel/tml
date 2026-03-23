import { expect, test } from "@playwright/test";

// These tests require a production build served over HTTPS — the service worker
// caches /_next/static/* assets which are unstable in dev mode. In CI they run
// against Vercel preview deployments (production build + HTTPS). Locally, skip
// unless BASE_URL points to a deployed target.

/** Wait for the service worker to activate and control the page. */
async function waitForSwController(page: import("@playwright/test").Page) {
  // Wait for SW to be active
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active !== undefined;
    },
    { timeout: 10_000 }
  );

  // If the page was loaded before the SW activated, controller is null.
  // A reload through the active SW ensures it becomes the controller.
  if (await page.evaluate(() => navigator.serviceWorker.controller === null)) {
    await page.reload();
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      { timeout: 5000 }
    );
  }
}

test.describe("PWA offline resilience", () => {
  test.skip(!process.env.BASE_URL, "Requires a deployed target (set BASE_URL)");

  test("service worker registers on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
    await waitForSwController(page);
  });

  test("landing page loads from cache when offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
    await waitForSwController(page);

    // Navigate again so the SW's fetch handler caches the page
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
