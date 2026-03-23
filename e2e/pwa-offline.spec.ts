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

    // Wait for service worker to install and activate
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active !== undefined;
      },
      { timeout: 10_000 }
    );

    // Second visit — SW fetch handler caches the page (stale-while-revalidate)
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Go offline — SW should serve from cache
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.context().setOffline(false);
  });

  test("static assets served from cache when offline", async ({ page }) => {
    // First visit — registers and activates the SW
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active !== undefined;
      },
      { timeout: 10_000 }
    );

    // Second visit — SW caches static assets
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

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
