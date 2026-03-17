import "server-only";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema/users";
import { sendWelcomeEmail } from "@/lib/email";
import { auth } from "./server";

/** Row shape returned by the upsert with Postgres xmax system column. */
interface UpsertResult {
  id: string;
  /** Postgres system column: "0" means INSERT, non-zero means UPDATE. */
  xmax: string;
}

/**
 * Ensures the authenticated user exists in the `public.users` table.
 *
 * Neon Auth manages users in its own schema (`neon_auth`), but the app
 * needs a corresponding row in `public.users` for preferences, locale,
 * theme, and role. This function lazily creates that row on first access.
 *
 * Uses INSERT ... ON CONFLICT DO UPDATE to upsert mutable profile fields.
 * Sends a welcome email when a new user row is created.
 */
export async function ensureUserExists(): Promise<void> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return;
  }

  const { id, email, name: rawName } = session.user;
  const displayName = rawName?.trim() || null;

  if (!(id && email)) {
    return;
  }

  let result: UpsertResult[];

  try {
    const db = getDb();

    result = await db
      .insert(users)
      .values({
        id,
        email,
        displayName,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          displayName,
          updatedAt: sql`NOW()`,
        },
        setWhere: sql`${users.email} IS DISTINCT FROM ${email} OR ${users.displayName} IS DISTINCT FROM ${displayName}`,
      })
      .returning({
        id: users.id,
        xmax: sql<string>`xmax`,
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
  const isNewUser = result.length > 0 && result[0].xmax === "0";

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
}
