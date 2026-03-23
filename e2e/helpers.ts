import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const AUTH_STATE_PATH = resolve(
  import.meta.dirname,
  "..",
  ".playwright/.auth/user.json"
);

/** Check if a real authenticated session exists (written by auth.setup.ts). */
export function hasAuthSession(): boolean {
  try {
    const state = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}
