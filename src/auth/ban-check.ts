import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema/users";

/**
 * Returns true if the given user is banned (bannedAt is non-null).
 *
 * Always queries the database — never trusts the cookie cache.
 * Fails closed: returns true if the user row doesn't exist.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ bannedAt: users.bannedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      return true;
    }

    return row.bannedAt !== null;
  } catch (error: unknown) {
    // Fail closed: during transient DB outages, all users are treated as banned.
    // This prioritizes security (preventing banned-user access) over availability.
    // Acceptable because the layout and server actions also depend on DB access
    // and would fail independently during an outage.
    console.error("Ban check failed, failing closed:", error);
    return true;
  }
}
