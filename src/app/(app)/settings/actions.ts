"use server";

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/auth/server";
import { USER_SYNCED_COOKIE } from "@/auth/sync-cookie";
import { getDb } from "@/db";
import { users } from "@/db/schema/users";
import type { Locale } from "@/i18n/config";
import { defaultLocale, isLocale } from "@/i18n/config";
import type { Theme } from "@/lib/theme";
import { isTheme } from "@/lib/theme";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Updates the authenticated user's locale in the database.
 *
 * The NEXT_LOCALE cookie is set client-side by the LocaleSelector after
 * this action succeeds — setting it here (via cookies().set()) would cause
 * a redirect loop because the app layout re-renders and re-evaluates cookies.
 */
export async function updateLocale(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) {
    return { success: false, error: "Invalid locale" };
  }

  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const db = getDb();
    const rows = await db
      .update(users)
      .set({ locale })
      .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (rows.length === 0) {
      return { success: false, error: "User not found" };
    }

    // Invalidate the user-synced cache so the next page load re-reads from DB
    (await cookies()).delete(USER_SYNCED_COOKIE);

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update locale:", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save locale" };
  }
}

/**
 * Updates the authenticated user's theme preference in the database.
 * The visual theme change is handled client-side by next-themes — this
 * action only persists the preference so it can be restored on new devices.
 */
export async function updateTheme(theme: string): Promise<ActionResult> {
  if (!isTheme(theme)) {
    return { success: false, error: "Invalid theme" };
  }

  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const db = getDb();
    const rows = await db
      .update(users)
      .set({ theme })
      .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (rows.length === 0) {
      return { success: false, error: "User not found" };
    }

    // Invalidate the user-synced cache so the next page load re-reads from DB
    (await cookies()).delete(USER_SYNCED_COOKIE);

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update theme:", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save theme" };
  }
}

/**
 * Reads the authenticated user's locale and theme from the database.
 * Used by the settings page to display current values.
 */
export async function getUserSettings(): Promise<{
  locale: Locale;
  theme: Theme;
} | null> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return null;
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ locale: users.locale, theme: users.theme })
      .from(users)
      .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      locale: isLocale(row.locale) ? row.locale : defaultLocale,
      theme: isTheme(row.theme) ? row.theme : "system",
    };
  } catch (error: unknown) {
    console.error("Failed to read user settings:", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
