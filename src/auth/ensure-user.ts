import "server-only";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
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
import { parseSyncCookie, USER_SYNCED_COOKIE } from "./sync-cookie";

/** Persisted user settings needed by the app layout for locale/theme restoration. */
interface UserSettings {
  locale: Locale;
  theme: Theme;
}

/** Row shape returned by the upsert with Postgres xmax system column. */
interface UpsertResult {
  bannedAt: Date | null;
  id: string;
  locale: string;
  theme: string;
  /** Postgres system column: "0" means INSERT, non-zero means UPDATE. */
  xmax: string;
}

/** Session shape derived from Neon Auth — stays in sync with library updates. */
type SessionData = NonNullable<
  Awaited<ReturnType<typeof auth.getSession>>["data"]
>;

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
export async function ensureUserExists(
  prefetchedSession?: SessionData
): Promise<UserSettings | null> {
  const session = prefetchedSession ?? (await auth.getSession()).data;

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
          // Clear soft-delete on re-login so a user who deleted their
          // account can seamlessly re-activate by signing in again.
          // Banned users are excluded — their deletedAt is preserved.
          deletedAt: sql`CASE WHEN ${users.bannedAt} IS NULL THEN NULL ELSE ${users.deletedAt} END`,
          // users.email.name / users.displayName.name are Drizzle's public
          // Column.name property, returning the raw SQL column identifier
          // (e.g., "email", "display_name"). Safe for sql.raw() because
          // column names are simple ASCII identifiers defined in our schema.
          updatedAt: sql`CASE WHEN ${users.email} IS DISTINCT FROM EXCLUDED.${sql.raw(`"${users.email.name}"`)} OR ${users.displayName} IS DISTINCT FROM EXCLUDED.${sql.raw(`"${users.displayName.name}"`)} OR ${users.deletedAt} IS DISTINCT FROM (CASE WHEN ${users.bannedAt} IS NULL THEN NULL ELSE ${users.deletedAt} END) THEN NOW() ELSE ${users.updatedAt} END`,
        },
      })
      .returning({
        id: users.id,
        locale: users.locale,
        theme: users.theme,
        bannedAt: users.bannedAt,
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

  const row = result[0];
  if (!row) {
    return null;
  }

  // Banned users must not gain app access, even though the upsert
  // syncs their auth-provider profile. Log for observability.
  if (row.bannedAt) {
    console.warn("[ensureUserExists] Banned user attempted login:", {
      userId: id,
      bannedAt: row.bannedAt,
    });
    return null;
  }

  // New-user detection via Postgres xmax system column:
  // xmax = "0" means the row was just INSERTed (new user).
  // xmax != "0" means the row was UPDATEd via the ON CONFLICT branch (existing user).
  const isNewUser = row.xmax === "0";

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

  return {
    locale: isLocale(row.locale) ? row.locale : defaultLocale,
    theme: isTheme(row.theme) ? row.theme : "system",
  };
}

/**
 * Returns user settings, using a cookie cache to avoid per-request DB upserts.
 *
 * Fast path: If the `user-synced` cookie exists and its userId matches the
 * current session, returns cached locale/theme without touching the database.
 *
 * Slow path: Falls through to `ensureUserExists()` for the full DB upsert
 * (first login, different user, expired/malformed cookie).
 *
 * Called once per request from the app layout, which passes its pre-fetched
 * session to avoid duplicate `auth.getSession()` calls.
 */
export async function getOrEnsureUserSettings(
  prefetchedSession?: SessionData
): Promise<UserSettings | null> {
  const session = prefetchedSession ?? (await auth.getSession()).data;

  if (!session?.user?.id) {
    return null;
  }

  const cookieStore = await cookies();
  const syncCookie = cookieStore.get(USER_SYNCED_COOKIE)?.value;

  if (syncCookie) {
    const parsed = parseSyncCookie(syncCookie);
    if (parsed && parsed.userId === session.user.id) {
      return { locale: parsed.locale, theme: parsed.theme };
    }
  }

  // Cookie absent, mismatched, or malformed — fall through to DB upsert.
  // Pass the pre-fetched session to avoid a duplicate auth.getSession() call.
  return ensureUserExists(session);
}

export type { UserSettings };
