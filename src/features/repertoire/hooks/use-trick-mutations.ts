"use client";

import { usePowerSync } from "@powersync/react";
import { authClient } from "@/auth/client";
import type { TagId, TrickId } from "@/db/types";
import { trackEvent } from "@/lib/analytics";
import type { TrickFormValues } from "../schema";

interface UseTrickMutationsReturn {
  createTrick: (data: TrickFormValues, tagIds: TagId[]) => Promise<TrickId>;
  deleteTrick: (id: TrickId) => Promise<void>;
  updateTrick: (
    id: TrickId,
    data: TrickFormValues,
    addTagIds: TagId[],
    removeTagIds: TagId[]
  ) => Promise<void>;
}

/** Converts an empty string to null for nullable text columns. */
function emptyToNull(value: string | undefined): string | null {
  return value?.trim() || null;
}

/** Converts a JS boolean | null to a SQLite integer (0/1/null). */
function booleanToInt(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

/**
 * Builds the flat array of SQL parameter values from form data for INSERT.
 *
 * **Column order must exactly match `TRICK_COLUMNS`:**
 *
 * | Index | Column             | Source                   |
 * |------:|--------------------|--------------------------|
 * |     0 | id                 | id                       |
 * |     1 | user_id            | userId                   |
 * |     2 | name               | data.name                |
 * |     3 | description        | data.description         |
 * |     4 | category           | data.category            |
 * |     5 | effect_type        | data.effectType          |
 * |     6 | difficulty         | data.difficulty           |
 * |     7 | status             | data.status              |
 * |     8 | duration           | data.duration            |
 * |     9 | performance_type   | data.performanceType     |
 * |    10 | angle_sensitivity  | data.angleSensitivity    |
 * |    11 | props              | data.props               |
 * |    12 | music              | data.music               |
 * |    13 | languages          | data.languages (JSON)    |
 * |    14 | is_camera_friendly | data.isCameraFriendly    |
 * |    15 | is_silent          | data.isSilent            |
 * |    16 | notes              | data.notes               |
 * |    17 | source             | data.source              |
 * |    18 | video_url          | data.videoUrl            |
 * |    19 | created_at         | now                      |
 * |    20 | updated_at         | now                      |
 */
function buildTrickParams(
  data: TrickFormValues,
  userId: string,
  id: string,
  now: string
): (string | number | null)[] {
  return [
    id, // 0  id
    userId, // 1  user_id
    data.name, // 2  name
    emptyToNull(data.description), // 3  description
    emptyToNull(data.category), // 4  category
    emptyToNull(data.effectType), // 5  effect_type
    data.difficulty ?? null, // 6  difficulty
    data.status, // 7  status
    data.duration ?? null, // 8  duration
    emptyToNull(data.performanceType ?? undefined), // 9  performance_type
    emptyToNull(data.angleSensitivity ?? undefined), // 10 angle_sensitivity
    emptyToNull(data.props), // 11 props
    emptyToNull(data.music), // 12 music
    data.languages && data.languages.length > 0 // 13 languages
      ? JSON.stringify(data.languages)
      : null,
    booleanToInt(data.isCameraFriendly), // 14 is_camera_friendly
    booleanToInt(data.isSilent), // 15 is_silent
    emptyToNull(data.notes), // 16 notes
    emptyToNull(data.source), // 17 source
    emptyToNull(data.videoUrl), // 18 video_url
    now, // 19 created_at
    now, // 20 updated_at
  ];
}

const TRICK_COLUMNS = [
  "id",
  "user_id",
  "name",
  "description",
  "category",
  "effect_type",
  "difficulty",
  "status",
  "duration",
  "performance_type",
  "angle_sensitivity",
  "props",
  "music",
  "languages",
  "is_camera_friendly",
  "is_silent",
  "notes",
  "source",
  "video_url",
  "created_at",
  "updated_at",
] as const;

const TRICK_INSERT_SQL = `
  INSERT INTO tricks (${TRICK_COLUMNS.join(", ")})
  VALUES (${TRICK_COLUMNS.map(() => "?").join(", ")})
`;

const TRICK_UPDATE_SQL = `
  UPDATE tricks SET
    user_id = ?,
    name = ?,
    description = ?,
    category = ?,
    effect_type = ?,
    difficulty = ?,
    status = ?,
    duration = ?,
    performance_type = ?,
    angle_sensitivity = ?,
    props = ?,
    music = ?,
    languages = ?,
    is_camera_friendly = ?,
    is_silent = ?,
    notes = ?,
    source = ?,
    video_url = ?,
    updated_at = ?
  WHERE id = ? AND user_id = ? AND deleted_at IS NULL
`;

/**
 * Provides mutation functions for creating, updating, and deleting tricks
 * in the local PowerSync SQLite database.
 *
 * Writes are queued by PowerSync and synced to Neon Postgres in the background.
 * The caller is responsible for showing toast notifications on success/error.
 */
export function useTrickMutations(): UseTrickMutationsReturn {
  const db = usePowerSync();
  const { data: session } = authClient.useSession();

  function getUserId(): string {
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("Cannot mutate tricks without an authenticated user");
    }
    return userId;
  }

  async function createTrick(
    data: TrickFormValues,
    tagIds: TagId[]
  ): Promise<TrickId> {
    const userId = getUserId();
    const id = crypto.randomUUID() as TrickId;
    const now = new Date().toISOString();

    try {
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          TRICK_INSERT_SQL,
          buildTrickParams(data, userId, id, now)
        );

        for (const tagId of tagIds) {
          const junctionId = crypto.randomUUID();
          await tx.execute(
            "INSERT INTO trick_tags (id, user_id, trick_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [junctionId, userId, id, tagId, now, now]
          );
        }
      });

      trackEvent("trick_created", {
        category: emptyToNull(data.category),
        status: data.status,
      });

      return id;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error creating trick";
      throw new Error(`Failed to create trick: ${message}`);
    }
  }

  async function updateTrick(
    id: TrickId,
    data: TrickFormValues,
    addTagIds: TagId[],
    removeTagIds: TagId[]
  ): Promise<void> {
    const userId = getUserId();
    const now = new Date().toISOString();

    try {
      await db.writeTransaction(async (tx) => {
        // UPDATE sets ALL columns (not just changed ones) for last-write-wins.
        // Params order: all SET columns, then WHERE id.
        const updateParams = [
          userId,
          data.name,
          emptyToNull(data.description),
          emptyToNull(data.category),
          emptyToNull(data.effectType),
          data.difficulty ?? null,
          data.status,
          data.duration ?? null,
          emptyToNull(data.performanceType ?? undefined),
          emptyToNull(data.angleSensitivity ?? undefined),
          emptyToNull(data.props),
          emptyToNull(data.music),
          data.languages && data.languages.length > 0
            ? JSON.stringify(data.languages)
            : null,
          booleanToInt(data.isCameraFriendly),
          booleanToInt(data.isSilent),
          emptyToNull(data.notes),
          emptyToNull(data.source),
          emptyToNull(data.videoUrl),
          now,
          id,
          userId,
        ];

        await tx.execute(TRICK_UPDATE_SQL, updateParams);

        // Remove tag associations by soft-deleting the junction rows.
        for (const tagId of removeTagIds) {
          await tx.execute(
            "UPDATE trick_tags SET deleted_at = ?, updated_at = ? WHERE trick_id = ? AND tag_id = ? AND user_id = ? AND deleted_at IS NULL",
            [now, now, id, tagId, userId]
          );
        }

        // Add new tag associations (restore soft-deleted rows first to avoid duplicates).
        for (const tagId of addTagIds) {
          const restored = await tx.execute(
            "UPDATE trick_tags SET deleted_at = NULL, updated_at = ? WHERE trick_id = ? AND tag_id = ? AND user_id = ? AND deleted_at IS NOT NULL",
            [now, id, tagId, userId]
          );
          if (!restored.rowsAffected) {
            const junctionId = crypto.randomUUID();
            await tx.execute(
              "INSERT INTO trick_tags (id, user_id, trick_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
              [junctionId, userId, id, tagId, now, now]
            );
          }
        }
      });

      trackEvent("trick_updated");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error updating trick";
      throw new Error(`Failed to update trick: ${message}`);
    }
  }

  async function deleteTrick(id: TrickId): Promise<void> {
    const userId = getUserId();
    const now = new Date().toISOString();

    try {
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          "UPDATE tricks SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
          [now, now, id, userId]
        );
        await tx.execute(
          "UPDATE trick_tags SET deleted_at = ?, updated_at = ? WHERE trick_id = ? AND user_id = ? AND deleted_at IS NULL",
          [now, now, id, userId]
        );
      });

      trackEvent("trick_deleted");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error deleting trick";
      throw new Error(`Failed to delete trick: ${message}`);
    }
  }

  return { createTrick, deleteTrick, updateTrick };
}
