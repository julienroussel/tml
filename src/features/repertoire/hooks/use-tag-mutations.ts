"use client";

import { usePowerSync } from "@powersync/react";
import { authClient } from "@/auth/client";
import { resolveUserId } from "@/auth/session-user";
import { asTagId, type TagId, type UserId } from "@/db/types";
import { trackEvent } from "@/lib/analytics";
import { safeLogEvent } from "@/lib/events/log";

interface UseTagMutationsReturn {
  createTag: (name: string, color?: string | null) => Promise<TagId>;
}

/**
 * Provides mutation functions for creating tags in the local PowerSync
 * SQLite database.
 *
 * Writes are queued by PowerSync and synced to Neon Postgres in the background.
 * The caller is responsible for showing toast notifications on success/error.
 */
export function useTagMutations(): UseTagMutationsReturn {
  const db = usePowerSync();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  function getUserId(): Promise<UserId> {
    return resolveUserId(
      session,
      sessionPending,
      "Cannot mutate tags without an authenticated user"
    );
  }

  async function createTag(
    name: string,
    color?: string | null
  ): Promise<TagId> {
    const userId = await getUserId();
    const id = asTagId(crypto.randomUUID());
    const now = new Date().toISOString();
    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      throw new Error("Tag name cannot be empty");
    }

    try {
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          "INSERT INTO tags (id, user_id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [id, userId, normalizedName, color ?? null, now, now]
        );
        await safeLogEvent(tx, {
          userId,
          type: "tag.created",
          entityType: "tag",
          entityId: id,
          payload: { name: normalizedName },
          now,
        });
      });

      trackEvent("tag_created");

      return id;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error creating tag";
      throw new Error(`Failed to create tag: ${message}`, { cause: error });
    }
  }

  return { createTag };
}
