import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

export const AUTH_STATE_PATH = resolve(
  import.meta.dirname,
  "..",
  ".playwright/.auth/user.json"
);

export const ADD_TRICK_RE = /add trick/i;
export const ADD_ITEM_RE = /add item/i;
export const NAME_RE = /^name$/i;

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
