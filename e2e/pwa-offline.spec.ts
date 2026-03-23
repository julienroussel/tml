import { expect, type Page, test } from "@playwright/test";

// These tests run in the "pwa" Playwright project which only exists when
// BASE_URL is not set (i.e., running against localhost with a production build).
// They are excluded from Vercel preview runs where Deployment Protection
// interferes with SW activation (clients.claim() never completes).
//
// NOTE: Full offline-navigation tests (verifying SW serves cached pages when
// offline) are not feasible in Playwright because Chromium's
// Network.emulateNetworkConditions bypasses SW fetch events entirely, and
// page.route() does not intercept requests handled by Service Workers.
// Instead, we verify the SW activates and populates the correct caches.

/**
 * Manually register and wait for the service worker to activate.
 *
 * The app's SW registration lives in push-notifications.tsx (authenticated
 * layout only), so the marketing landing page doesn't trigger it.
 * Tests call navigator.serviceWorker.register() directly.
 */
async function registerAndActivateSW(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    const sw = reg.installing ?? reg.waiting ?? reg.active;
    if (!sw) {
      throw new Error("No SW found after registration");
    }
    if (sw.state === "activated") {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`SW stuck in "${sw.state}" state`)),
        15_000
      );
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  });
}

/**
 * Wait for the SW to become the page's controller via clients.claim().
 */
async function waitForController(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("SW controller not claimed within 15 s")),
        15_000
      );
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true }
      );
    });
  });
}

test.describe("PWA offline resilience", () => {
  test("service worker registers and activates", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    await registerAndActivateSW(page);

    // After activate, clients.claim() should make the SW the controller
    await waitForController(page);

    const hasController = await page.evaluate(
      () => navigator.serviceWorker.controller != null
    );
    expect(hasController).toBe(true);
  });

  test("expected caches are created", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    await registerAndActivateSW(page);
    await waitForController(page);

    // Navigate so the SW fetch handler intercepts requests and populates caches
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toContain("static-v1");
    expect(cacheNames).toContain("pages-v1");
  });

  test("static assets are cached after navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    await registerAndActivateSW(page);
    await waitForController(page);

    // Navigate again — SW fetch handler intercepts and caches the response
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    const cacheInfo = await page.evaluate(async () => {
      const staticCache = await caches.open("static-v1");
      const pagesCache = await caches.open("pages-v1");
      const staticKeys = await staticCache.keys();
      const pagesKeys = await pagesCache.keys();
      return {
        staticCount: staticKeys.length,
        pagesCount: pagesKeys.length,
        hasNextStatic: staticKeys.some((r) =>
          new URL(r.url).pathname.startsWith("/_next/static/")
        ),
      };
    });

    expect(cacheInfo.staticCount).toBeGreaterThan(0);
    expect(cacheInfo.pagesCount).toBeGreaterThan(0);
    expect(cacheInfo.hasNextStatic).toBe(true);
  });
});
