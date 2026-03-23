import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { AUTH_STATE_PATH } from "./helpers";

/**
 * Playwright auth setup — creates an authenticated session via Better Auth's
 * email+password sign-in API and saves browser state for reuse.
 *
 * Prerequisites:
 * - Enable "Email & Password" sign-in in Neon Console > Auth > Configuration
 * - Create a test user with known credentials (or sign up via the API below)
 * - Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables
 *
 * This runs once before all authenticated test specs. The session cookies are
 * saved to .playwright/.auth/user.json and reused across tests.
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

setup("authenticate", async ({ page }) => {
  if (!(TEST_EMAIL && TEST_PASSWORD)) {
    if (process.env.CI) {
      throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in CI");
    }
    // Write a valid-but-empty storage state so Playwright can parse it
    // without crashing. Authenticated tests detect empty cookies and skip.
    mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
    writeFileSync(
      AUTH_STATE_PATH,
      JSON.stringify({ cookies: [], origins: [] }),
      "utf-8"
    );
  }

  setup.skip(
    !(TEST_EMAIL && TEST_PASSWORD),
    "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set"
  );

  // Try signing in via the Better Auth email+password endpoint.
  // Neon Auth proxies Better Auth under /api/auth/*.
  const signInResponse = await page.request.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    }
  );

  // If sign-in fails with 401/404, the test user may not exist yet.
  // Try creating it first, then sign in again.
  if (!signInResponse.ok()) {
    const signUpResponse = await page.request.post(
      `${BASE_URL}/api/auth/sign-up/email`,
      {
        data: {
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          name: "E2E Test User",
        },
      }
    );

    // Sign-up might fail if the user already exists — that's fine,
    // we'll try sign-in one more time regardless.
    if (!signUpResponse.ok()) {
      console.warn(
        `Sign-up returned ${signUpResponse.status()} — trying sign-in again`
      );
    }

    const retryResponse = await page.request.post(
      `${BASE_URL}/api/auth/sign-in/email`,
      {
        data: {
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        },
      }
    );

    expect(
      retryResponse.ok(),
      `Sign-in failed: ${retryResponse.status()} ${await retryResponse.text()}`
    ).toBe(true);
  }

  // Navigate to the app to ensure cookies are properly set in the browser context
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard**");

  // Save the authenticated browser state
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
