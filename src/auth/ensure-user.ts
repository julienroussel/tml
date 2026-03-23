import "server-only";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema/user-preferences";
import { users } from "@/db/schema/users";
import type { Locale } from "@/i18n/config";
import { defaultLocale, isLocale } from "@/i18n/config";
import { sendWelcomeEmail } from "@/lib/email";
import type { Theme } from "@/lib/theme";
import { isTheme } from "@/lib/theme";
import { auth } from "./server";

/** Persisted user settings needed by the app layout for locale/theme restoration. */
interface UserSettings {
  locale: Locale;
  theme: Theme;
}

/** Row shape returned by the upsert with Postgres xmax system column. */
interface UpsertResult {
  id: string;
  locale: string;
  theme: string;
  /** Postgres system column: "0" means INSERT, non-zero means UPDATE. */
  xmax: string;
}

/**
 * Ensures the authenticated user exists in the `public.users` table and
 * that a corresponding `user_preferences` row exists.
 *
 * Neon Auth manages users in its own schema (`neon_auth`), but the app
 * needs a corresponding row in `public.users` for preferences, locale,
 * theme, and role. This function lazily creates that row on first access.
 *
 * Uses INSERT ... ON CONFLICT DO UPDATE to upsert mutable profile fields.
 * Sends a welcome email when a new user row is created.
 *
 * Returns the user's persisted locale and theme so the app layout can
 * restore them into cookies/headers on new device login.
 */
export async function ensureUserExists(): Promise<UserSettings | null> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { id, email, name: rawName } = session.user;
  const displayName = rawName?.trim() || null;

  if (!(id && email)) {
    return null;
  }

  let result: UpsertResult[];

  try {
    const db = getDb();

    result = (await db
      .insert(users)
      .values({
        id,
        email,
        displayName,
      })
      // The DO UPDATE is unconditional so RETURNING always provides
      // locale/theme for settings restoration. updated_at is only
      // bumped when mutable fields actually change, avoiding
      // unnecessary PowerSync re-syncs.
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          displayName,
          // users.email.name / users.displayName.name are Drizzle's public
          // Column.name property, returning the raw SQL column identifier
          // (e.g., "email", "display_name"). Safe for sql.raw() because
          // column names are simple ASCII identifiers defined in our schema.
          updatedAt: sql`CASE WHEN ${users.email} IS DISTINCT FROM EXCLUDED.${sql.raw(`"${users.email.name}"`)} OR ${users.displayName} IS DISTINCT FROM EXCLUDED.${sql.raw(`"${users.displayName.name}"`)} THEN NOW() ELSE ${users.updatedAt} END`,
        },
      })
      .returning({
        id: users.id,
        locale: users.locale,
        theme: users.theme,
        xmax: sql<string>`xmax`,
      })) satisfies UpsertResult[];

    // Ensure a user_preferences row exists — all columns have defaults,
    // so we only need to set the userId. ON CONFLICT DO NOTHING handles
    // the expected duplicate case at the DB level, so errors reaching
    // the catch below are genuinely unexpected (schema issues, connection problems).
    await db
      .insert(userPreferences)
      .values({ userId: id })
      .onConflictDoNothing({ target: userPreferences.userId })
      .catch((error: unknown) => {
        // Non-fatal: preferences row creation failure shouldn't block login
        console.error(
          "[ensureUserExists] user_preferences insert failed — non-fatal:",
          {
            userId: id,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      });
  } catch (error: unknown) {
    console.error("Failed to sync user to database:", {
      userId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to initialize user profile", { cause: error });
  }

  // New-user detection via Postgres xmax system column:
  // xmax = "0" means the row was just INSERTed (new user).
  // xmax != "0" means the row was UPDATEd via the ON CONFLICT branch (existing user).
  const isNewUser = result.length > 0 && result[0]?.xmax === "0";

  if (isNewUser) {
    after(() =>
      sendWelcomeEmail({
        to: email,
        name: displayName ?? undefined,
        userId: id,
      }).catch((error: unknown) => {
        console.error("Failed to send welcome email:", {
          userId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  }

  const row = result[0];
  if (!row) {
    return null;
  }

  return {
    locale: isLocale(row.locale) ? row.locale : defaultLocale,
    theme: isTheme(row.theme) ? row.theme : "system",
  };
}

export type { UserSettings };
