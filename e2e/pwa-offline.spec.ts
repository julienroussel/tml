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
 * Wait for the app to auto-register the SW and activate it.
 * Polls `getRegistration()` until an active SW appears (up to 15s).
 */
async function waitForAutoRegistration(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("SW did not auto-register within 15s")),
        15_000
      );

      async function check(): Promise<void> {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sw = reg?.active ?? reg?.waiting ?? reg?.installing;
        if (sw?.state === "activated") {
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (sw) {
          sw.addEventListener("statechange", () => {
            if (sw.state === "activated") {
              clearTimeout(timeout);
              resolve();
            }
          });
        } else {
          setTimeout(check, 500);
        }
      }

      check();
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
  test("app auto-registers service worker without manual intervention", async ({
    page,
  }) => {
    // Navigate to the marketing page — no manual SW registration.
    // The ServiceWorkerRegistration component in the root layout should
    // register sw.js automatically after page load.
    // Use locale-prefixed URL to avoid the 302 redirect from bare "/".
    await page.goto("/en");
    await page.locator("main#main-content").waitFor({ state: "attached" });

    await waitForAutoRegistration(page);

    // Verify the SW claimed the page as controller
    await waitForController(page);
    const hasController = await page.evaluate(
      () => navigator.serviceWorker.controller != null
    );
    expect(hasController).toBe(true);
  });

  test("auto-registered SW caches assets on subsequent navigation", async ({
    page,
  }) => {
    // First load — triggers SW registration
    // Use locale-prefixed URLs to avoid the 302 redirect from bare paths.
    await page.goto("/en");
    await page.locator("main#main-content").waitFor({ state: "attached" });

    await waitForAutoRegistration(page);
    await waitForController(page);

    // Second navigation — SW intercepts and caches
    await page.goto("/en/faq");
    await page.locator("main#main-content").waitFor({ state: "attached" });

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
        cachedPages: pagesKeys.map((r) => new URL(r.url).pathname),
      };
    });

    expect(cacheInfo.staticCount).toBeGreaterThan(0);
    expect(cacheInfo.hasNextStatic).toBe(true);
    expect(cacheInfo.pagesCount).toBeGreaterThan(0);
    expect(cacheInfo.cachedPages).toContain("/en/faq");
  });
});
