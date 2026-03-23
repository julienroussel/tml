import { expect, test } from "@playwright/test";

// These tests require a production build served over HTTPS — the service worker
// caches /_next/static/* assets which are unstable in dev mode. In CI they run
// against Vercel preview deployments (production build + HTTPS). Locally, skip
// unless BASE_URL points to a deployed target.
//
// NOTE: Full offline-navigation tests (verifying SW serves cached pages when
// offline) are not feasible in Playwright because:
// 1. Chromium's Network.emulateNetworkConditions bypasses SW fetch events
// 2. Vercel Deployment Protection's bypass header interferes with clients.claim()
// These are tested by verifying the SW activates and correct caches exist.

test.describe("PWA offline resilience", () => {
  test.skip(!process.env.BASE_URL, "Requires a deployed target (set BASE_URL)");

  test("service worker registers and activates", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for the SW to reach the "activated" state
    const swState = await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active ? "activated" : null;
      },
      { timeout: 15_000 }
    );

    expect(await swState.jsonValue()).toBe("activated");
  });

  test("expected caches are created", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();

    // Wait for SW to activate
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active != null;
      },
      { timeout: 15_000 }
    );

    // SW's activate handler creates the expected caches
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toContain("static-v1");
    expect(cacheNames).toContain("pages-v1");
  });
});
