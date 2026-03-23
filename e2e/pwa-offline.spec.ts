import { expect, test } from "@playwright/test";

// Skipped until a proper HTTPS test environment is available — see #94.
// Service workers require: (1) a production build (not dev server),
// (2) HTTPS or localhost, and (3) Chromium to not be in headless mode
// for some SW APIs. The current CI setup uses a production build but
// headless Chromium still fails to register the SW reliably.

test.describe("PWA offline resilience", () => {
  test.skip(true, "Requires HTTPS test environment — tracked in #94");

  test("service worker registers on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Service worker should be registered
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        return false;
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });
    expect(swRegistered).toBe(true);
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
