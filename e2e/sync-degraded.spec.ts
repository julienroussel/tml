import { expect, test } from "@playwright/test";
import { TEST_BUCKET_HEALTH_OVERRIDE } from "../src/sync/test-override-key";
import { hasAuthSession, waitForSync, waitForSyncReady } from "./helpers";

/**
 * Regression coverage for issue #332.
 *
 * The pill must report `degraded` (not `online`) when the PowerSync sync
 * stream subscribes successfully but produces no server-side buckets. This
 * is the silent failure mode that left local-dev / preview sessions
 * "connected but receiving nothing" with no UI signal — items appeared in
 * /collect momentarily then got wiped on the next sync cycle.
 *
 * Strategy: inject the `__TEST_FORCE_BUCKET_HEALTH` window flag via
 * `addInitScript` BEFORE any app code runs. `useBucketHealth` reads this
 * flag in non-production builds and returns the override verbatim, which
 * cleanly bypasses the live `ps_buckets` query without engineering an
 * empty server stream. The production bundle ignores the flag.
 */

const ONLINE_PILL_SELECTOR = '[data-sync-state="online"]';

test.describe("SyncStatus degraded state (#332)", () => {
  // Sync-degraded coverage requires a connectable PowerSync instance — the
  // degraded branch is reached only when `connected:true` + `lastSyncedAt`
  // are set by the live runtime (the override only forces `useBucketHealth`,
  // not `useStatus`). On Vercel preview the preview-issued JWT is rejected
  // at the WebSocket handshake (PSYNC_S2105), so `connected` stays false and
  // `waitForSync(page, "degraded")` would time out. Localhost only — same
  // shape as the PWA spec gating in playwright.config.ts:89.
  test.skip(
    !!process.env.BASE_URL,
    "Sync-degraded spec requires a connectable PowerSync instance; previews cannot reach one (see .claude/rules/sync-engine.md → Preview Deployment Sync Coverage)."
  );

  test.beforeEach(({ browserName: _ }) => {
    test.skip(!hasAuthSession(), "No authenticated session available");
  });

  test("pill flips to degraded when only the $local bucket exists", async ({
    page,
  }) => {
    await page.addInitScript((flagName: string) => {
      // Single-cast form. The flag is intentionally unscoped in the global
      // type surface (it's a non-production-only test hook, not a documented
      // contract). Same form is used in both addInitScript callbacks and the
      // page.evaluate readback below so a future contributor cannot wonder
      // whether the double-cast variant is "the safe one".
      (globalThis as Record<string, unknown>)[flagName] = {
        hasServerBuckets: false,
        isLoading: false,
        error: null,
      };
    }, TEST_BUCKET_HEALTH_OVERRIDE);

    await page.goto("/dashboard");

    // Wait until PowerSync's local DB is open AND the pill has reached one of
    // its post-connect states. `waitForSync(page, "degraded")` confirms the
    // SyncStatus state-machine prioritization landed on degraded — i.e., the
    // connected + lastSyncedAt branch evaluated `hasServerBuckets=false` and
    // surfaced the new key instead of silently saying "online".
    await waitForSyncReady(page);
    await waitForSync(page, "degraded");

    // Belt-and-braces: the pill must not also be claiming "online". If both
    // attributes appeared (which would mean the state machine matched both
    // branches), the test fails here.
    await expect(page.locator(ONLINE_PILL_SELECTOR)).toHaveCount(0);
  });
});
