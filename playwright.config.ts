import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { BYPASS_STATE_PATH } from "./e2e/global-setup";
import { AUTH_STATE_PATH } from "./e2e/helpers";

// Load .env.local for E2E credentials — Next.js does this automatically
// for the app, but Playwright needs it explicitly.
config({ path: ".env.local" });
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

// When testing against a Vercel preview, the global setup navigates with
// the bypass query param and saves the _vercel_jwt cookie to a state file.
// All projects load this state so the cookie is included in every request
// (including service worker script fetches that don't use extraHTTPHeaders).
const hasVercelBypass = !!(
  process.env.BASE_URL && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Load Vercel bypass cookie if available (set by global-setup.ts)
    ...(hasVercelBypass && { storageState: BYPASS_STATE_PATH }),
  },
  projects: [
    // Auth setup — runs first, creates authenticated session state
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Unauthenticated tests — smoke, auth redirects, PWA
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /settings-.*\.spec\.ts/,
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
  ],
  // When BASE_URL is set (e.g., Vercel preview), skip the local dev server
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
});
