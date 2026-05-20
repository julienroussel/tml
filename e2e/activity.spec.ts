import { expect, test } from "@playwright/test";
import {
  ADD_ITEM_RE,
  ADD_TRICK_RE,
  createItem,
  createTrick,
  hasAuthSession,
  waitForAddButton,
  waitForSync,
  waitForSyncReady,
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
    // Offline ↔ online transitions add real wall-clock time on top of every
    // already-30s wait; without test.slow() the suite hits Playwright's default
    // 30s per-test budget mid-reconnect (issue #297).
    test.slow();
    const name = `E2E Activity Offline ${Date.now().toString()}`;

    // Boot the app online and wait for the local WASQLite database to finish
    // opening — worker spawned, WASM compiled — BEFORE dropping the network.
    // `waitForSyncReady` gates on `data-powersync-db-ready` (a real
    // `powerSyncDb.waitForReady()` signal); the offline write has no database
    // to land in until it resolves.
    await page.goto("/repertoire");
    await waitForAddButton(page, ADD_TRICK_RE);
    await waitForSyncReady(page);

    // Drop the network, then create a trick. The trick + event_log rows still
    // write to local SQLite via PowerSync's writeTransaction; `createTrick`
    // asserts the form closes and the new card appears, confirming the offline
    // write landed and `useQuery` re-read it — with no network round-trip.
    await context.setOffline(true);
    // The offline transition itself destabilizes the page (WebSocket drop +
    // SyncStatus re-render). Wait for the pill to settle into "offline" before
    // clicking — otherwise the Add-trick click can't pin a stable target
    // within the 10s actionTimeout (issue #297 confirmed failure mode).
    await waitForSync(page, "offline");
    try {
      await createTrick(page, name);
    } finally {
      await context.setOffline(false);
    }

    // After reconnect, the event_log row written while offline must surface
    // on /activity. This assertion runs online on purpose: a full `page.goto`
    // while offline cannot be served by the service worker under Playwright's
    // offline emulation (see the note at the top of e2e/pwa-offline.spec.ts).
    // /activity still reads from local SQLite, so a passing assertion confirms
    // the offline-written row survived the reconnect — not a server round-trip.
    //
    // `setOffline(false)` restores the network, but the transition is not
    // instantaneous — a navigation fired in the same tick can still hit
    // net::ERR_INTERNET_DISCONNECTED (issue #297 timing territory). Retry the
    // navigation with `toPass` so a too-early first attempt is absorbed.
    await expect(async () => {
      await page.goto("/activity");
    }).toPass({ timeout: 30_000 });
    const timeline = page.getByRole("list", { name: TIMELINE_LABEL_RE });
    await expect(timeline).toBeVisible({ timeout: 30_000 });
    await expect(timeline.locator("li", { hasText: name })).toBeVisible({
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
