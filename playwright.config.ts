import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { BYPASS_STATE_PATH } from "./e2e/global-setup";
import { AUTH_STATE_PATH } from "./e2e/helpers";

// Load .env.local for E2E credentials — Next.js does this automatically
// for the app, but Playwright needs it explicitly.
config({ path: ".env.local" });
// Local dev uses --experimental-https (HTTPS); CI uses pnpm start (HTTP).
const baseURL =
  process.env.BASE_URL ??
  (process.env.CI ? "http://localhost:3000" : "https://localhost:3000");

// When testing against a Vercel preview, the global setup navigates with
// the bypass query param and saves the _vercel_jwt cookie to a state file.
// All projects load this state so the cookie is included in every request
// (including service worker script fetches that don't use extraHTTPHeaders).
const hasVercelBypass = !!(
  process.env.BASE_URL && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
);

// In CI, PLAYWRIGHT_SKIP_BUILD reuses the .next/ output from an earlier step.
// Without it, build + start from scratch. Locally, use the Turbopack dev server.
function webServerCommand(): string {
  if (!process.env.CI) {
    return "pnpm dev";
  }
  if (process.env.PLAYWRIGHT_SKIP_BUILD) {
    return "pnpm start";
  }
  return "pnpm build && pnpm start";
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  maxFailures: process.env.CI ? 5 : undefined,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "on-first-retry",
    // Accept self-signed certificate from --experimental-https in local dev
    ignoreHTTPSErrors: !process.env.CI,
    // Load Vercel bypass cookie if available (set by global-setup.ts)
    ...(hasVercelBypass && { storageState: BYPASS_STATE_PATH }),
  },
  projects: [
    // Auth setup — runs first, creates authenticated session state
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Unauthenticated tests — smoke, auth redirects
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /settings-.*\.spec\.ts|pwa-offline\.spec\.ts/,
    },
    // Authenticated tests — settings, locale, theme
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STATE_PATH,
      },
      testMatch: /settings-.*\.spec\.ts/,
      dependencies: ["setup"],
    },
    // PWA tests — SW registration, activation, cache verification.
    // Only runs on localhost (production build); excluded from Vercel previews
    // where Deployment Protection blocks SW activation.
    ...(process.env.BASE_URL
      ? []
      : [
          {
            name: "pwa",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /pwa-offline\.spec\.ts/,
          },
        ]),
  ],
  // When BASE_URL is set (e.g., Vercel preview), skip the local dev server
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: webServerCommand(),
        url: process.env.CI
          ? "http://localhost:3000"
          : "https://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
});
