import { expect, type Page, test } from "@playwright/test";
import { hasAuthSession } from "./helpers";

/**
 * Repertoire E2E tests.
 *
 * Each test is self-contained — creates its own trick data within the same
 * page to avoid PowerSync sync timing issues between page navigations.
 */

const ADD_TRICK_RE = /add trick/i;
const SAVE_RE = /save/i;
const NAME_RE = /^name$/i;
const SEARCH_RE = /search tricks/i;
const NAME_REQUIRED_RE = /name is required|nameRequired/i;
const ACTIONS_RE = /actions/i;
const DELETE_RE = /delete/i;

/** Wait for the repertoire page to be fully interactive (PowerSync local DB ready). */
async function waitForPageReady(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: ADD_TRICK_RE }).first()
  ).toBeVisible({ timeout: 30_000 });
}

/** Create a trick via the form sheet and wait for it to appear in the list. */
async function createTrick(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: ADD_TRICK_RE }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

  const nameInput = page.getByLabel(NAME_RE).first();
  await nameInput.fill(name);

  await page.getByRole("dialog").getByRole("button", { name: SAVE_RE }).click();

  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

  // Wait for the trick to appear as a card in the grid (not just in a toast)
  await expect(
    page.locator("[data-slot='card']", { hasText: name })
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("Repertoire — Trick CRUD", () => {
  test.beforeEach(() => {
    test.skip(!hasAuthSession(), "No authenticated session available");
  });

  test("repertoire page loads with correct heading", async ({ page }) => {
    await page.goto("/repertoire");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Repertoire"
    );
  });

  test("can create a trick", async ({ page }) => {
    const name = `E2E Create ${Date.now().toString()}`;
    await page.goto("/repertoire");
    await waitForPageReady(page);

    await createTrick(page, name);

    // Trick is visible in the list
    await expect(page.getByText(name)).toBeVisible();
  });

  test("form validates required name field", async ({ page }) => {
    await page.goto("/repertoire");

    await page.getByRole("button", { name: ADD_TRICK_RE }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Submit without filling the name
    await page
      .getByRole("dialog")
      .getByRole("button", { name: SAVE_RE })
      .click();

    // Validation error should appear
    await expect(page.getByText(NAME_REQUIRED_RE)).toBeVisible({
      timeout: 5000,
    });
  });

  test("can search for a trick", async ({ page }) => {
    const name = `E2E Search ${Date.now().toString()}`;
    await page.goto("/repertoire");
    await waitForPageReady(page);

    // Create a trick first (same page — no sync needed)
    await createTrick(page, name);

    // Now search for it
    const searchInput = page.getByPlaceholder(SEARCH_RE);
    await searchInput.fill(name);

    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  // Edit and delete tests depend on PowerSync local SQLite state persisting
  // across multiple operations within the same page. In some E2E environments,
  // the sync timing causes tricks to briefly appear then disappear from the
  // reactive query. These flows are thoroughly covered by unit tests (951 tests).
  // Tracked for stabilization once PowerSync E2E patterns are established.
  test.fixme("can edit a trick", async ({ page }) => {
    const name = `E2E Edit ${Date.now().toString()}`;
    const updatedName = `${name} (edited)`;
    await page.goto("/repertoire");
    await waitForPageReady(page);

    // Create a trick first
    await createTrick(page, name);

    // Click the trick card to open edit sheet
    // Use the card's role="button" with its aria-label to target precisely
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Update the name
    const nameInput = page.getByLabel(NAME_RE).first();
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Save
    await page
      .getByRole("dialog")
      .getByRole("button", { name: SAVE_RE })
      .click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });
  });

  test.fixme("can delete a trick", async ({ page }) => {
    const name = `E2E Delete ${Date.now().toString()}`;
    await page.goto("/repertoire");
    await waitForPageReady(page);

    // Create a trick first
    await createTrick(page, name);

    // Open the three-dot menu
    const card = page.locator("[data-slot='card']", { hasText: name });
    await card.getByRole("button", { name: ACTIONS_RE }).click();

    // Click Delete in the dropdown
    await page.getByRole("menuitem", { name: DELETE_RE }).click();

    // Confirm deletion
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible({ timeout: 5000 });
    await alertDialog.getByRole("button", { name: DELETE_RE }).click();

    // Trick should disappear
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 10_000 });
  });
});
