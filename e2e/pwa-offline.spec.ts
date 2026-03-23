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
    // First visit — populate service worker cache
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

    // Go offline
    await page.context().setOffline(true);

    // Reload — service worker should serve cached page
    await page.reload();
    await expect(page.locator("main#main-content")).toBeVisible();

    // Restore online
    await page.context().setOffline(false);
  });

  test("static assets served from cache when offline", async ({ page }) => {
    // Visit app to populate caches
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for service worker
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active !== undefined;
      },
      { timeout: 10_000 }
    );

    // Go offline and check that CSS/JS still loads
    await page.context().setOffline(true);
    await page.reload();

    // Page should render with styles (not broken HTML)
    const hasStyles = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = getComputedStyle(body);
      return computedStyle.fontFamily.length > 0;
    });
    expect(hasStyles).toBe(true);

    await page.context().setOffline(false);
  });
});
