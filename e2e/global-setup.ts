import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type APIRequestContext, chromium } from "@playwright/test";

/**
 * Pre-warm a single asset URL and surface degraded states. Returns nothing —
 * failures are non-fatal so the test run can still proceed (workers will be
 * fetched on demand), but any non-2xx response or thrown error is logged so
 * a silently broken pre-warm (e.g., worker URL drift after a PowerSync bump)
 * is visible in CI output instead of disappearing into `.catch(() => undefined)`.
 */
async function prewarm(request: APIRequestContext, url: string): Promise<void> {
  try {
    const res = await request.get(url);
    if (!res.ok()) {
      console.warn(
        `[global-setup] pre-warm ${url} returned ${res.status()} — worker URL may have drifted`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[global-setup] pre-warm ${url} threw: ${message}`);
  }
}

/**
 * Playwright global setup — runs once before all tests.
 *
 * If a Vercel Deployment Protection bypass secret is configured, this
 * navigates to the deployment URL with the bypass query params to set
 * the _vercel_jwt cookie. The cookie is saved to a storage state file
 * so all browser contexts automatically include it.
 *
 * This is necessary because Vercel's SSO-based deployment protection
 * blocks requests without the cookie — including the SW script fetch
 * at /sw.js which doesn't use Playwright's extraHTTPHeaders.
 */

export const BYPASS_STATE_PATH = ".playwright/.auth/bypass.json";

export default async function globalSetup() {
  const baseURL = process.env.BASE_URL;
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  if (!(baseURL && bypassSecret)) {
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate with the bypass query params — Vercel sets a _vercel_jwt cookie
  await page.goto(
    `${baseURL}/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${bypassSecret}`
  );

  // Save the cookie state for reuse by all test projects
  mkdirSync(dirname(BYPASS_STATE_PATH), { recursive: true });
  await context.storageState({ path: BYPASS_STATE_PATH });

  // Pre-warm Vercel's edge CDN for PowerSync's large worker bundles so the
  // first authenticated context doesn't pay the cold-fetch cost. Errors are
  // non-fatal but logged by `prewarm()` so a silently-broken pre-warm
  // (e.g., worker URL drift after a version bump) is visible in CI output.
  await Promise.all([
    prewarm(page.request, `${baseURL}/powersync/worker/WASQLiteDB.umd.js`),
    prewarm(
      page.request,
      `${baseURL}/powersync/worker/SharedSyncImplementation.umd.js`
    ),
  ]);

  await browser.close();

  // Remove the extraHTTPHeaders approach — cookie-based bypass is sufficient
  // and works for all requests including SW script fetches.
}
