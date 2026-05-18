/**
 * DIAG #300 — REMOVE BEFORE MERGE.
 *
 * Reads `data-diag-token-*` attributes stamped by provider.tsx's diagnostic
 * getToken() wrapper to determine WHY PowerSync doesn't sync on previews.
 *
 * Results surface in CI logs under "Activity feed" without needing Vercel
 * log access. Run only in the authenticated project (session required so the
 * token endpoint is actually hit with a real session).
 */
import { expect, test } from "@playwright/test";
import { hasAuthSession } from "./helpers";

test.describe("DIAG #300 — PowerSync token diagnostics", () => {
  test.beforeEach(() => {
    test.skip(!hasAuthSession(), "No authenticated session — skipping diag");
  });

  test("reports /api/auth/token status and token shape from preview", async ({
    page,
  }) => {
    // Navigate to a page that mounts PowerSyncProvider (any (app) route).
    await page.goto("/dashboard");
    // Give getToken() up to 15s to fire after page load.
    await page.waitForFunction(
      () => document.documentElement.hasAttribute("data-diag-token-status"),
      undefined,
      { timeout: 15_000 }
    );

    const tokenStatus = await page.evaluate(
      () =>
        document.documentElement.getAttribute("data-diag-token-status") ??
        "not-set"
    );
    const tokenOk = await page.evaluate(
      () =>
        document.documentElement.getAttribute("data-diag-token-ok") ?? "not-set"
    );
    const hasSynced = await page.evaluate(
      () =>
        document.querySelector("[role='status'][data-has-synced='true']") !==
        null
    );
    const syncState = await page.evaluate(
      () =>
        document
          .querySelector("[role='status']")
          ?.getAttribute("data-sync-state") ?? "not-found"
    );

    // Log everything so the CI output tells us which branch (B1/B2/B3) applies.
    console.log(
      `[DIAG #300] token-status=${tokenStatus} token-ok=${tokenOk} ` +
        `has-synced=${hasSynced} sync-state=${syncState}`
    );

    // The test itself always passes — we're collecting data, not asserting.
    // The console.log above is the diagnostic output.
    expect(tokenStatus).not.toBe("not-set");
  });
});
