import { expect, test } from "@playwright/test";

/**
 * Settings locale E2E tests.
 *
 * Validates the full data flow for changing language:
 * Cookie (local) → Server re-render → DB persist (fire-and-forget).
 *
 * Offline-first design:
 * - Cookie is the local source of truth (set immediately, works offline)
 * - DB update is fire-and-forget (syncs when online)
 * - SettingsRestorer handles bidirectional sync on mount
 *
 * Note: The page heading is server-rendered via getTranslations(), so it only
 * updates after a navigation/reload that picks up the new NEXT_LOCALE cookie.
 */

test.describe("Settings — Language change", () => {
  test.afterEach(async ({ page }) => {
    // Reset locale to English for test isolation
    await page.context().clearCookies({ name: "NEXT_LOCALE" });
  });

  test("user can change language in settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Change to French — sets cookie + updates client context
    const localeSelect = page.locator("#locale-select");
    await localeSelect.selectOption("fr");

    // Reload to trigger server re-render with new NEXT_LOCALE cookie
    await page.reload();

    // Verify French title renders
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Paramètres"
    );
  });

  test("language persists across page navigation", async ({ page }) => {
    await page.goto("/settings");
    const localeSelect = page.locator("#locale-select");
    await localeSelect.selectOption("fr");

    // Reload first to ensure the cookie is read by the server
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Paramètres"
    );

    // Navigate to dashboard and back — cookie should persist
    await page.goto("/dashboard");
    await page.goto("/settings");

    // Verify French heading after navigation
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Paramètres"
    );
    await expect(page.locator("#locale-select")).toHaveValue("fr");
  });

  test("language persists across page reload", async ({ page }) => {
    await page.goto("/settings");
    const localeSelect = page.locator("#locale-select");
    await localeSelect.selectOption("es");

    // Hard reload
    await page.reload();

    // Verify Spanish persists
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Ajustes"
    );

    // Verify NEXT_LOCALE cookie
    const cookies = await page.context().cookies();
    const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(localeCookie?.value).toBe("es");
  });

  // This test depends on the fire-and-forget updateLocale() server action completing
  // and then SettingsRestorer reading the DB value on next mount. In dev mode, the
  // fire-and-forget timing is unreliable (cancelled by navigation, slow dev server).
  // Tracked as a follow-up to run reliably in CI with production builds.
  test.fixme("language restores from DB on fresh login", async ({ page }) => {
    test.setTimeout(60_000);

    // Set language to German — sets cookie + fires DB write
    await page.goto("/settings");
    const localeSelect = page.locator("#locale-select");
    await localeSelect.selectOption("de");

    // Wait for ALL network activity to settle (including fire-and-forget server action)
    await page.waitForTimeout(3000);

    // Reload so the server reads the cookie and renders German
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Einstellungen"
    );

    // Navigate to trigger another SettingsRestorer sync cycle (cookie→DB)
    await page.goto("/settings");
    await page.waitForTimeout(3000);

    // Now simulate a new device: delete the cookie
    await page.context().clearCookies({ name: "NEXT_LOCALE" });

    // Navigate — SettingsRestorer detects missing cookie, restores from DB
    await page.goto("/settings");

    // SettingsRestorer sets cookie from dbLocale and calls router.refresh().
    // Wait for the refresh to propagate: check that the cookie gets set.
    await expect(async () => {
      const cookies = await page.context().cookies();
      const lc = cookies.find((c) => c.name === "NEXT_LOCALE");
      expect(lc?.value).toBe("de");
    }).toPass({ timeout: 10_000 });

    // Reload to get server-rendered heading in German
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Einstellungen"
    );
  });

  test("locale cookie is set even when offline (offline-first)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Go offline
    await page.context().setOffline(true);

    // Change locale while offline — cookie should still be set
    const localeSelect = page.locator("#locale-select");
    await localeSelect.selectOption("it");

    // Verify the cookie was set locally despite being offline
    const cookies = await page.context().cookies();
    const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(localeCookie?.value).toBe("it");

    // Go back online
    await page.context().setOffline(false);
    // Wait for network to stabilize before navigating
    await page.waitForTimeout(1000);

    // Navigate to settings — server re-renders with Italian cookie
    await page.goto("/settings");

    // Verify Italian is applied
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Impostazioni",
      { timeout: 10_000 }
    );
  });

  // Same timing issue as "language restores from DB on fresh login" — the
  // fire-and-forget DB write via SettingsRestorer's cookie→DB sync is unreliable
  // in dev mode E2E. The offline cookie-setting part is tested separately above.
  test.fixme("offline locale change syncs to DB when back online", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Go offline and change locale — cookie is set, DB write fails silently
    await page.context().setOffline(true);

    // Wait for select to be interactable (SettingsRestorer may cause re-renders)
    const localeSelect = page.locator("#locale-select");
    await expect(localeSelect).toBeVisible();
    await localeSelect.selectOption("pt");

    // Verify cookie was set offline
    const offlineCookies = await page.context().cookies();
    expect(offlineCookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe(
      "pt"
    );

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);

    // Navigate — SettingsRestorer detects cookie≠DB and syncs cookie→DB
    await page.goto("/settings");
    await page.waitForTimeout(3000);

    // Navigate again to give SettingsRestorer another sync opportunity
    await page.goto("/settings");
    await page.waitForTimeout(3000);

    // Delete cookie to simulate new device — if DB was synced, locale restores
    await page.context().clearCookies({ name: "NEXT_LOCALE" });
    await page.goto("/settings");

    // Wait for SettingsRestorer to restore cookie from DB
    await expect(async () => {
      const cookies = await page.context().cookies();
      const lc = cookies.find((c) => c.name === "NEXT_LOCALE");
      expect(lc?.value).toBe("pt");
    }).toPass({ timeout: 10_000 });

    // Reload so server reads the restored cookie
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Definições"
    );
  });

  test("locale select has exactly 7 options", async ({ page }) => {
    await page.goto("/settings");
    const options = page.locator("#locale-select option");
    await expect(options).toHaveCount(7);
  });
});
