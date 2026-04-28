import { expect, test } from "@playwright/test";
import {
  ADD_ITEM_RE,
  ADD_TRICK_RE,
  createItem,
  createTrick,
  hasAuthSession,
  waitForAddButton,
} from "./helpers";

/**
 * Activity feed E2E.
 *
 * Each test creates its own data with a timestamped name so the activity
 * feed (which accumulates across runs) can be searched by that unique name.
 *
 * Scope: CREATE → READ across page navigations. UPDATE/DELETE deferred —
 * see repertoire.spec.ts:124-128 for the underlying PowerSync sync-timing
 * limitation. Standalone tag.created coverage is also deferred — tags are
 * created inside the trick form's TagPicker (cmdk popover), which adds
 * unrelated UI complexity; the tag-mutations dual-sink wiring is covered
 * by unit tests in src/features/repertoire/hooks/use-tag-mutations.test.ts.
 */

const ACTIVITY_HEADING_RE = /^activity$/i;
const TIMELINE_LABEL_RE = /Activity timeline/i;
const TRICK_CREATED_RE = /Created trick/i;
const ITEM_CREATED_RE = /Added .* to your collection/i;
const TRICKS_OPTION_RE = /tricks/i;

test.describe("Activity feed", () => {
  test.beforeEach(() => {
    test.skip(!hasAuthSession(), "No authenticated session available");
  });

  test("/activity loads with the right heading", async ({ page }) => {
    await page.goto("/activity");
    await expect(
      page.getByRole("heading", { level: 1, name: ACTIVITY_HEADING_RE })
    ).toBeVisible({ timeout: 30_000 });
  });

  test("creating a trick adds an entry on /activity", async ({ page }) => {
    const name = `E2E Activity Trick ${Date.now().toString()}`;

    // Atomic write: trick row + event_log row inside one PowerSync writeTransaction.
    await page.goto("/repertoire");
    await waitForAddButton(page, ADD_TRICK_RE);
    await createTrick(page, name);

    // Read back: useQuery against local SQLite picks up the row reactively.
    await page.goto("/activity");
    const timeline = page.getByRole("list", { name: TIMELINE_LABEL_RE });
    await expect(timeline).toBeVisible({ timeout: 30_000 });

    const row = timeline.locator("li", { hasText: name });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(TRICK_CREATED_RE);
  });

  test("creating an item adds an entry on /activity", async ({ page }) => {
    const name = `E2E Activity Item ${Date.now().toString()}`;

    await page.goto("/collect");
    await waitForAddButton(page, ADD_ITEM_RE);
    await createItem(page, name);

    await page.goto("/activity");
    const timeline = page.getByRole("list", { name: TIMELINE_LABEL_RE });
    await expect(timeline).toBeVisible({ timeout: 30_000 });

    const row = timeline.locator("li", { hasText: name });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(ITEM_CREATED_RE);
  });

  test("recent activity card on /dashboard shows the latest action", async ({
    page,
  }) => {
    const name = `E2E Activity Dashboard ${Date.now().toString()}`;

    await page.goto("/repertoire");
    await waitForAddButton(page, ADD_TRICK_RE);
    await createTrick(page, name);

    await page.goto("/dashboard");
    const timeline = page.getByRole("list", { name: TIMELINE_LABEL_RE });
    await expect(timeline).toBeVisible({ timeout: 30_000 });

    // The just-created trick should be the most recent — first <li>.
    await expect(timeline.locator("li").first()).toContainText(name, {
      timeout: 30_000,
    });
  });

  test("captures activity offline and surfaces it after reconnect", async ({
    context,
    page,
  }) => {
    const name = `E2E Activity Offline ${Date.now().toString()}`;

    // Boot the app + PowerSync online so the local SQLite is initialised.
    await page.goto("/repertoire");
    await waitForAddButton(page, ADD_TRICK_RE);

    // Drop the network — the trick + event_log row should still write to
    // local SQLite via PowerSync's writeTransaction. The form should close
    // and the card appear without any network round-trip.
    await context.setOffline(true);
    try {
      await createTrick(page, name);

      // /activity reads from local SQLite, so the offline-written event row
      // must appear without leaving offline mode.
      await page.goto("/activity");
      const timeline = page.getByRole("list", { name: TIMELINE_LABEL_RE });
      await expect(timeline).toBeVisible({ timeout: 30_000 });
      await expect(timeline.locator("li", { hasText: name })).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await context.setOffline(false);
    }

    // Reconnect should not erase the row; it stays visible while the
    // upload queue drains in the background.
    await page.reload();
    const timelineAfter = page.getByRole("list", { name: TIMELINE_LABEL_RE });
    await expect(timelineAfter).toBeVisible({ timeout: 30_000 });
    await expect(timelineAfter.locator("li", { hasText: name })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("filters /activity to a single entity type", async ({ page }) => {
    const trickName = `E2E Filter Trick ${Date.now().toString()}`;
    const itemName = `E2E Filter Item ${Date.now().toString()}`;

    await page.goto("/repertoire");
    await waitForAddButton(page, ADD_TRICK_RE);
    await createTrick(page, trickName);

    await page.goto("/collect");
    await waitForAddButton(page, ADD_ITEM_RE);
    await createItem(page, itemName);

    await page.goto("/activity");
    const timeline = page.getByRole("list", { name: TIMELINE_LABEL_RE });
    await expect(timeline).toBeVisible({ timeout: 30_000 });

    // Both entries are present before filtering.
    await expect(timeline.locator("li", { hasText: trickName })).toBeVisible({
      timeout: 30_000,
    });
    await expect(timeline.locator("li", { hasText: itemName })).toBeVisible({
      timeout: 30_000,
    });

    // Open the entity filter and choose Tricks. The associated <label>
    // is "Show" (en); we open the Select via its accessible role.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: TRICKS_OPTION_RE }).click();

    await expect(timeline.locator("li", { hasText: trickName })).toBeVisible({
      timeout: 10_000,
    });
    await expect(timeline.locator("li", { hasText: itemName })).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  // Empty-state coverage is contested: the suite shares one authenticated
  // user across tests (auth.setup.ts) and that user has accumulated events
  // from the create-trick / create-item tests above. Asserting the empty
  // state would require either a fresh-user fixture (out of scope for this
  // PR) or destructive cleanup of the shared user's event_log. Component-
  // level coverage of the empty state lives in
  // src/features/activity/components/activity-empty-state.tsx renderings.
});
