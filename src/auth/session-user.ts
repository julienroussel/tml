"use client";

import { authClient } from "@/auth/client";
import { asUserId, type UserId } from "@/db/types";

/**
 * How long a mutation waits for an in-flight session fetch before giving up.
 *
 * Measured cold-load `/api/auth/get-session` latency was ~355ms, so 3s leaves
 * headroom for a slow-but-working network while still unblocking the form.
 *
 * The bound is applied with `Promise.race` rather than better-fetch's own
 * `fetchOptions.timeout`: the Neon adapter dedupes concurrent `/get-session`
 * requests by method+url+body and hands back the first caller's promise, which
 * carries no abort signal of ours — so `timeout` is a no-op on exactly the
 * in-flight path this guards. Racing also leaves the shared fetch running for
 * its other consumers instead of aborting it out from under them.
 */
const SESSION_WAIT_MS = 3000;

/**
 * Resolves the signed-in user's id for a client mutation.
 *
 * Callers pass the reactive session and its pending flag from
 * `authClient.useSession()`, plus the domain-specific error message to throw
 * when no user can be resolved.
 */
export async function resolveUserId(
  session: ReturnType<typeof authClient.useSession>["data"],
  sessionPending: boolean,
  errorMessage: string
): Promise<UserId> {
  const userId = session?.user?.id;
  if (userId) {
    return asUserId(userId);
  }

  // On a cold load the reactive session can still be in flight when the user
  // submits, and throwing here drops the write behind an error toast. Wait for
  // it only while it is genuinely pending.
  //
  // A session that has settled to null falls through to the throw. That is
  // right for a signed-out user, but it also catches an offline cold boot,
  // where the session fetch already failed and every local write is refused
  // even though PowerSync's SQLite is readable. Tracked in issue #430.
  if (sessionPending) {
    let pendingUserId: string | undefined;
    let failure: unknown;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const { data, error } = await Promise.race([
        authClient.getSession(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error("Timed out waiting for the session")),
            SESSION_WAIT_MS
          );
        }),
      ]);
      pendingUserId = data?.user?.id;
      // `getSession` rejects on network failure and on a non-ok response, so
      // this only carries an error the adapter chose to return rather than
      // throw. Kept so that case still reaches the caller as a `cause`.
      failure = error;
    } catch (caught) {
      failure = caught;
    } finally {
      clearTimeout(timer);
    }

    if (pendingUserId) {
      return asUserId(pendingUserId);
    }
    throw new Error(errorMessage, { cause: failure });
  }

  throw new Error(errorMessage);
}
