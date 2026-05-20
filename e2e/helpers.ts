import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import type {
  FALLBACK_SYNC_STATE,
  SyncKey,
} from "../src/components/sync-status";

export const AUTH_STATE_PATH = resolve(
  import.meta.dirname,
  "..",
  ".playwright/.auth/user.json"
);

export const ADD_TRICK_RE = /add trick/i;
export const ADD_ITEM_RE = /add item/i;
export const NAME_RE = /^name$/i;

/**
 * Union of all `data-sync-state` values the `<SyncStatus>` pill can emit:
 * the canonical `SyncKey` set plus the `FALLBACK_SYNC_STATE` sentinel from
 * `SyncStatusFallback`. Both sides are imported (not duplicated) so the
 * union and the rendered attribute can't drift.
 */
export type SyncState = SyncKey | typeof FALLBACK_SYNC_STATE;

/**
 * Wait for the `<SyncStatus>` pill (rendered in the app shell) to reach a
 * specific transport state. Reads the `data-sync-state` attribute set by
 * `SyncStatusInner` — see `src/components/sync-status.tsx`.
 */
export async function waitForSync(
  page: Page,
  expectedState: SyncState = "online",
  timeout = 30_000
): Promise<void> {
  await expect(
    page.locator(`[data-sync-state="${expectedState}"]`).first()
  ).toBeVisible({ timeout });
}

/**
 * Wait until PowerSync's local WASQLite database is genuinely open — worker
 * spawned, wa-sqlite chunk + WASM downloaded and compiled, schema applied — so
 * `db` can accept `writeTransaction` / `getAll` calls. Backed by
 * `powerSyncDb.waitForReady()`, surfaced as `data-powersync-db-ready="true"`
 * by `PowerSyncProvider` (`src/sync/provider.tsx`).
 *
 * This is the gate to use before `context.setOffline(true)`: the worker and
 * WASM load lazily over the network, and dropping the connection before they
 * finish aborts the load (`net::ERR_INTERNET_DISCONNECTED`), leaving the
 * database permanently unopened. It does NOT wait for a server-to-client sync
 * — prefer `waitForSynced` only when server data must be present.
 *
 * Note: `data-sync-state` leaving "uninitialized" only means the PowerSync
 * React context mounted (see `deriveSyncKey` in `src/components/sync-status.tsx`)
 * — it does not imply the WASM has loaded. Do not gate the offline transition
 * on it.
 */
export async function waitForSyncReady(
  page: Page,
  timeout = 30_000
): Promise<void> {
  await expect(
    page.locator('[data-powersync-db-ready="true"]').first()
  ).toBeAttached({ timeout });
}

/**
 * Wait for PowerSync to have completed at least one full initial sync
 * (`status.lastSyncedAt != null`). The underlying primitive is `lastSyncedAt`
 * (sticky across disconnects), not `hasSynced` (reset on every disconnect by
 * PowerSync's status merge). Only use this when server data must be present
 * before proceeding — on environments where PowerSync can't reach its sync
 * service, this will hang indefinitely. For most write-path tests, prefer
 * `waitForSyncReady`.
 *
 * Vercel preview deployments are currently exactly such an environment:
 * preview-issued JWTs are rejected by the production PowerSync instance, so
 * the sync stream never connects. This helper therefore has no caller and is
 * effectively production-only. See the "Preview Deployment Sync Coverage"
 * section in `.claude/rules/sync-engine.md` (issue #302); a dedicated preview
 * PowerSync instance is tracked in #312.
 */
export async function waitForSynced(
  page: Page,
  timeout = 30_000
): Promise<void> {
  await expect(page.locator('[data-has-synced="true"]').first()).toBeVisible({
    timeout,
  });
}

/** Check if a real authenticated session exists (written by auth.setup.ts). */
export function hasAuthSession(): boolean {
  try {
    const state = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/**
 * Wait for a feature page's primary "add" button to be visible. The first
 * authenticated navigation also boots PowerSync, so the timeout is generous.
 */
export async function waitForAddButton(
  page: Page,
  buttonNameRe: RegExp
): Promise<void> {
  await expect(
    page.getByRole("button", { name: buttonNameRe }).first()
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Submit via requestSubmit() — bypasses the Next.js dev overlay that blocks
 * pointer events on the Save button in dev mode.
 */
async function submitFormById(page: Page, formId: string): Promise<void> {
  await page.locator(`#${formId}`).evaluate((el) => {
    (el as HTMLFormElement).requestSubmit();
  });
}

async function throwSheetStuck(
  page: Page,
  formId: string,
  nameInput: ReturnType<Page["getByLabel"]>
): Promise<never> {
  const formErrors = await page
    .locator(`#${formId} [data-slot='form-message']`)
    .allTextContents()
    .catch(() => []);
  const toasts = await page
    .locator("[data-sonner-toast]")
    .allTextContents()
    .catch(() => []);
  const nameValue = await nameInput.inputValue().catch(() => "???");
  throw new Error(
    [
      "Sheet stayed open after save.",
      `Name value: "${nameValue}"`,
      `Form validation errors: [${formErrors.join(" | ")}]`,
      `Toasts: [${toasts.join(" | ")}]`,
    ].join("\n")
  );
}

async function createEntity(
  page: Page,
  args: { addButtonRe: RegExp; formId: string; name: string }
): Promise<void> {
  await page.getByRole("button", { name: args.addButtonRe }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

  const nameInput = page.getByLabel(NAME_RE).first();
  await nameInput.fill(args.name);

  await submitFormById(page, args.formId);

  try {
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 30_000 });
  } catch {
    await throwSheetStuck(page, args.formId, nameInput);
  }

  await expect(
    page.locator("[data-slot='card']", { hasText: args.name })
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Open the trick form sheet, fill `name`, submit, and wait for the new
 * card to appear in the grid. Caller is responsible for being on /repertoire.
 */
export async function createTrick(page: Page, name: string): Promise<void> {
  await createEntity(page, {
    addButtonRe: ADD_TRICK_RE,
    formId: "trick-form",
    name,
  });
}

/**
 * Open the item form sheet, fill `name` (type defaults to "prop"), submit,
 * and wait for the new card to appear in the grid. Caller is responsible
 * for being on /collect.
 */
export async function createItem(page: Page, name: string): Promise<void> {
  await createEntity(page, {
    addButtonRe: ADD_ITEM_RE,
    formId: "item-form",
    name,
  });
}
