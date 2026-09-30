import { expect, test } from "@playwright/test";
import { hasAuthSession } from "./helpers";

/**
 * Settings theme E2E tests.
 *
 * Offline-first design:
 * - next-themes (localStorage/cookie) is the local source of truth
 * - DB update is fire-and-forget (syncs when online)
 * - SettingsRestorer handles bidirectional sync on mount
 */

const DARK_PATTERN = /dark/i;
const LIGHT_PATTERN = /light/i;
const SYSTEM_PATTERN = /system/i;

test.describe("Settings — Theme change", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthSession(), "No authenticated session available");

    // The selector renders the DB theme, which an earlier test's
    // fire-and-forget "Reset" may not have written back before its context
    // closed. Start every test (and retry) from "system" in the DB.
    await page.goto("/settings");
    const systemRadio = page.getByRole("radio", { name: SYSTEM_PATTERN });
    if (!(await systemRadio.isChecked())) {
      const persisted = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          (response.request().postData() ?? "").includes('"system"')
      );
      await systemRadio.check({ force: true });
      await persisted;
    }
  });

  test("user can change theme to dark mode", async ({ page }) => {
    await page.goto("/settings");

    const darkRadio = page.getByRole("radio", { name: DARK_PATTERN });
    await darkRadio.check({ force: true });

    await expect(page.locator("html")).toHaveClass(DARK_PATTERN);

    // Reset
    const systemRadio = page.getByRole("radio", { name: SYSTEM_PATTERN });
    await systemRadio.check({ force: true });
  });

  test("theme persists across page reload", async ({ page }) => {
    await page.goto("/settings");

    const darkRadio = page.getByRole("radio", { name: DARK_PATTERN });
    await darkRadio.check({ force: true });

    await expect(page.locator("html")).toHaveClass(DARK_PATTERN);

    await page.reload();

    await expect(page.locator("html")).toHaveClass(DARK_PATTERN);

    // Reset
    const systemRadio = page.getByRole("radio", { name: SYSTEM_PATTERN });
    await systemRadio.check({ force: true });
  });

  test("theme selector shows current selection", async ({ page }) => {
    await page.goto("/settings");

    const lightRadio = page.getByRole("radio", { name: LIGHT_PATTERN });
    await lightRadio.check({ force: true });
    await expect(lightRadio).toBeChecked();

    const darkRadio = page.getByRole("radio", { name: DARK_PATTERN });
    await darkRadio.check({ force: true });
    await expect(darkRadio).toBeChecked();
    await expect(lightRadio).not.toBeChecked();

    // Reset
    const systemRadio = page.getByRole("radio", { name: SYSTEM_PATTERN });
    await systemRadio.check({ force: true });
  });

  test("theme change works offline (offline-first)", async ({ page }) => {
    await page.goto("/settings");

    // Wait for ThemeSelector to mount (it renders a placeholder until useEffect fires)
    const darkRadio = page.getByRole("radio", { name: DARK_PATTERN });
    await expect(darkRadio).toBeVisible({ timeout: 10_000 });

    // Go offline
    await page.context().setOffline(true);

    // Change theme while offline — next-themes sets immediately via localStorage
    await darkRadio.check({ force: true });

    // Verify dark mode applied instantly (no server round-trip needed)
    await expect(page.locator("html")).toHaveClass(DARK_PATTERN);

    // Go back online
    await page.context().setOffline(false);

    // Reload to let SettingsRestorer sync localStorage→DB
    await page.goto("/settings", { waitUntil: "domcontentloaded" });

    // Verify dark mode persists
    await expect(page.locator("html")).toHaveClass(DARK_PATTERN);

    // Reset
    const systemRadio = page.getByRole("radio", { name: SYSTEM_PATTERN });
    await systemRadio.check({ force: true });
  });
});
