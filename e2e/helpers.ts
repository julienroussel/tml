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
    page.locator(`[role="status"][data-sync-state="${expectedState}"]`).first()
  ).toBeVisible({ timeout });
}

/**
 * Wait for PowerSync context to be fully initialized — WASM loaded, workers
 * up, and the status hook mounted — without requiring a server-to-client sync.
 * Once `data-sync-state` is anything other than "uninitialized", `db` is ready
 * to accept `writeTransaction` calls (schema is set up from the JS definition,
 * not the first sync). Use this before going offline in E2E tests; prefer
 * `waitForSynced` only when you actually need a completed server sync.
 */
export async function waitForSyncReady(
  page: Page,
  timeout = 30_000
): Promise<void> {
  await expect(
    page
      .locator(`[role="status"]:not([data-sync-state="uninitialized"])`)
      .first()
  ).toBeVisible({ timeout });
}

/**
 * Wait for PowerSync to have completed at least one full initial sync
 * (`status.lastSyncedAt != null`). The underlying primitive is `lastSyncedAt`
 * (sticky across disconnects), not `hasSynced` (reset on every disconnect by
 * PowerSync's status merge). Only use this when server data must be present
 * before proceeding — on environments where PowerSync can't reach its sync
 * service, this will hang indefinitely. For most write-path tests, prefer
 * `waitForSyncReady`.
 */
export async function waitForSynced(
  page: Page,
  timeout = 30_000
): Promise<void> {
  await expect(
    page.locator('[role="status"][data-has-synced="true"]').first()
  ).toBeVisible({ timeout });
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
