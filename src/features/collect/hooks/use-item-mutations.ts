"use client";

import { usePowerSync } from "@powersync/react";
import { authClient } from "@/auth/client";
import {
  asItemId,
  asUserId,
  type ItemId,
  type TagId,
  type TrickId,
  type UserId,
} from "@/db/types";
import { trackEvent } from "@/lib/analytics";
import { MAX_TAGS_PER_ITEM, MAX_TRICKS_PER_ITEM } from "../constants";
import type { ItemFormValues } from "../schema";

interface UseItemMutationsReturn {
  createItem: (
    data: ItemFormValues,
    tagIds: TagId[],
    trickIds: TrickId[]
  ) => Promise<ItemId>;
  deleteItem: (id: ItemId) => Promise<void>;
  updateItem: (
    id: ItemId,
    data: ItemFormValues,
    addTagIds: TagId[],
    removeTagIds: TagId[],
    addTrickIds: TrickId[],
    removeTrickIds: TrickId[]
  ) => Promise<void>;
}

/**
 * Typed mutation errors. The `tag` field discriminates error kinds so the
 * UI toast boundary can map each tag to a localized message without relying
 * on the English `message` text.
 */
class MaxTagsError extends Error {
  readonly tag = "MAX_TAGS" as const;
  constructor() {
    super("MAX_TAGS");
    this.name = "MaxTagsError";
  }
}

class MaxTricksError extends Error {
  readonly tag = "MAX_TRICKS" as const;
  constructor() {
    super("MAX_TRICKS");
    this.name = "MaxTricksError";
  }
}

class ItemNotFoundError extends Error {
  readonly tag = "ITEM_NOT_FOUND" as const;
  constructor() {
    super("ITEM_NOT_FOUND");
    this.name = "ItemNotFoundError";
  }
}

type TypedMutationError = MaxTagsError | MaxTricksError | ItemNotFoundError;

function isTypedMutationError(error: unknown): error is TypedMutationError {
  return (
    error instanceof MaxTagsError ||
    error instanceof MaxTricksError ||
    error instanceof ItemNotFoundError
  );
}

type TypedMutationErrorTag = TypedMutationError["tag"];

/**
 * Maps each typed error tag to an i18n key. The `satisfies` clause makes
 * this map exhaustive at compile time — adding a new typed error class
 * without updating this map fails `tsc`.
 */
const MUTATION_ERROR_I18N_KEYS = {
  MAX_TAGS: "validation.tooManyTags",
  MAX_TRICKS: "validation.tooManyTricks",
  ITEM_NOT_FOUND: "errors.itemMissing",
} as const satisfies Record<TypedMutationErrorTag, string>;

/**
 * Maps a caught mutation error to its i18n key, or `null` if it's not a
 * typed mutation error. Consumers use this at toast boundaries to replace
 * the `instanceof` chain duplication across call sites.
 */
export function getMutationErrorKey(error: unknown): string | null {
  if (!isTypedMutationError(error)) {
    return null;
  }
  return MUTATION_ERROR_I18N_KEYS[error.tag];
}

export { ItemNotFoundError, MaxTagsError, MaxTricksError };

/** Converts an empty string to null for nullable text columns. */
function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Builds the flat array of SQL parameter values from form data for INSERT.
 *
 * **Column order must exactly match `ITEM_COLUMNS`:**
 *
 * | Index | Column         | Source                 |
 * |------:|----------------|------------------------|
 * |     0 | id             | id                     |
 * |     1 | user_id        | userId                 |
 * |     2 | name           | data.name              |
 * |     3 | type           | data.type              |
 * |     4 | description    | data.description       |
 * |     5 | brand          | data.brand             |
 * |     6 | condition      | data.condition         |
 * |     7 | location       | data.location          |
 * |     8 | notes          | data.notes             |
 * |     9 | purchase_date  | data.purchaseDate      |
 * |    10 | purchase_price | data.purchasePrice     |
 * |    11 | quantity       | data.quantity           |
 * |    12 | creator        | data.creator           |
 * |    13 | url            | data.url               |
 * |    14 | created_at     | now                    |
 * |    15 | updated_at     | now                    |
 */
function buildItemParams(
  data: ItemFormValues,
  userId: UserId,
  id: ItemId,
  now: string
): (string | number | null)[] {
  return [
    id, // 0  id
    userId, // 1  user_id
    data.name, // 2  name
    data.type, // 3  type
    emptyToNull(data.description), // 4  description
    emptyToNull(data.brand), // 5  brand
    data.condition ?? null, // 6  condition
    emptyToNull(data.location), // 7  location
    emptyToNull(data.notes), // 8  notes
    emptyToNull(data.purchaseDate), // 9  purchase_date
    emptyToNull(data.purchasePrice), // 10 purchase_price
    data.quantity ?? 1, // 11 quantity
    emptyToNull(data.creator), // 12 creator
    emptyToNull(data.url), // 13 url
    now, // 14 created_at
    now, // 15 updated_at
  ];
}

/**
 * Narrowed transaction interface for junction table operations.
 *
 * PowerSync's `Transaction` (from `@powersync/common`) extends `LockContext`
 * which extends `SqlExecutor`. `SqlExecutor.execute` uses `params?: any[]`
 * and returns `Promise<QueryResult>`, which includes `rowsAffected` plus
 * extra fields (insertId, rows) we don't need here. Using the PowerSync
 * `Transaction` type directly would work, but it also exposes `commit()`,
 * `rollback()`, `getAll()`, `getOptional()`, `get()`, `executeBatch()`, and
 * `executeRaw()` — none of which junction diffs should call. This minimal
 * interface keeps the contract narrow on purpose.
 */
interface JunctionTransaction {
  execute(sql: string, params: unknown[]): Promise<{ rowsAffected: number }>;
}

/** Discriminated config for type-safe junction table diffs. */
type JunctionDiffConfig =
  | {
      table: "item_tags";
      fkColumn: "tag_id";
      addIds: TagId[];
      removeIds: TagId[];
    }
  | {
      table: "item_tricks";
      fkColumn: "trick_id";
      addIds: TrickId[];
      removeIds: TrickId[];
    };

/** Applies junction table diffs (soft-delete removed, restore/insert added). */
async function applyJunctionDiff(
  tx: JunctionTransaction,
  config: JunctionDiffConfig,
  itemId: ItemId,
  userId: UserId,
  now: string
): Promise<void> {
  const { table, fkColumn, addIds, removeIds } = config;

  for (const fkId of removeIds) {
    await tx.execute(
      `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE item_id = ? AND ${fkColumn} = ? AND user_id = ? AND deleted_at IS NULL`,
      [now, now, itemId, fkId, userId]
    );
  }

  for (const fkId of addIds) {
    const restored = await tx.execute(
      `UPDATE ${table} SET deleted_at = NULL, updated_at = ? WHERE item_id = ? AND ${fkColumn} = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [now, itemId, fkId, userId]
    );
    if (!restored.rowsAffected) {
      const junctionId = crypto.randomUUID();
      await tx.execute(
        `INSERT INTO ${table} (id, user_id, item_id, ${fkColumn}, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [junctionId, userId, itemId, fkId, now, now]
      );
    }
  }
}

const ITEM_COLUMNS = [
  "id",
  "user_id",
  "name",
  "type",
  "description",
  "brand",
  "condition",
  "location",
  "notes",
  "purchase_date",
  "purchase_price",
  "quantity",
  "creator",
  "url",
  "created_at",
  "updated_at",
] as const;

const ITEM_INSERT_SQL = `
  INSERT INTO items (${ITEM_COLUMNS.join(", ")})
  VALUES (${ITEM_COLUMNS.map(() => "?").join(", ")})
`;

/** Columns excluded from UPDATE SET — they're immutable after INSERT. */
const ITEM_UPDATE_EXCLUDE = new Set(["id", "created_at"]);

const ITEM_UPDATE_COLUMNS = ITEM_COLUMNS.filter(
  (col) => !ITEM_UPDATE_EXCLUDE.has(col)
);

const ITEM_UPDATE_SQL = `
  UPDATE items SET
    ${ITEM_UPDATE_COLUMNS.map((col) => `${col} = ?`).join(",\n    ")}
  WHERE id = ? AND user_id = ? AND deleted_at IS NULL
`;

/**
 * Provides mutation functions for creating, updating, and deleting items
 * in the local PowerSync SQLite database.
 *
 * Writes are queued by PowerSync and synced to Neon Postgres in the background.
 * The caller is responsible for showing toast notifications on success/error.
 */
export function useItemMutations(): UseItemMutationsReturn {
  const db = usePowerSync();
  const { data: session } = authClient.useSession();

  function getUserId(): UserId {
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("Cannot mutate items without an authenticated user");
    }
    return asUserId(userId);
  }

  async function createItem(
    data: ItemFormValues,
    tagIds: TagId[],
    trickIds: TrickId[]
  ): Promise<ItemId> {
    if (tagIds.length > MAX_TAGS_PER_ITEM) {
      throw new MaxTagsError();
    }
    if (trickIds.length > MAX_TRICKS_PER_ITEM) {
      throw new MaxTricksError();
    }

    const userId = getUserId();
    const id = asItemId(crypto.randomUUID());
    const now = new Date().toISOString();

    try {
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          ITEM_INSERT_SQL,
          buildItemParams(data, userId, id, now)
        );

        for (const tagId of tagIds) {
          const junctionId = crypto.randomUUID();
          await tx.execute(
            "INSERT INTO item_tags (id, user_id, item_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [junctionId, userId, id, tagId, now, now]
          );
        }

        for (const trickId of trickIds) {
          const junctionId = crypto.randomUUID();
          await tx.execute(
            "INSERT INTO item_tricks (id, user_id, item_id, trick_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [junctionId, userId, id, trickId, now, now]
          );
        }
      });

      trackEvent("item_created", { type: data.type });

      return id;
    } catch (error: unknown) {
      if (isTypedMutationError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Unknown error creating item";
      throw new Error(`Failed to create item: ${message}`, { cause: error });
    }
  }

  async function updateItem(
    id: ItemId,
    data: ItemFormValues,
    addTagIds: TagId[],
    removeTagIds: TagId[],
    addTrickIds: TrickId[],
    removeTrickIds: TrickId[]
  ): Promise<void> {
    if (addTagIds.length > MAX_TAGS_PER_ITEM) {
      throw new MaxTagsError();
    }
    if (addTrickIds.length > MAX_TRICKS_PER_ITEM) {
      throw new MaxTricksError();
    }

    const userId = getUserId();
    const now = new Date().toISOString();

    try {
      await db.writeTransaction(async (tx) => {
        const updateParams = [
          userId,
          data.name,
          data.type,
          emptyToNull(data.description),
          emptyToNull(data.brand),
          data.condition ?? null,
          emptyToNull(data.location),
          emptyToNull(data.notes),
          emptyToNull(data.purchaseDate),
          emptyToNull(data.purchasePrice),
          data.quantity ?? 1,
          emptyToNull(data.creator),
          emptyToNull(data.url),
          now,
          id,
          userId,
        ];

        const result = await tx.execute(ITEM_UPDATE_SQL, updateParams);
        if (!result.rowsAffected) {
          throw new ItemNotFoundError();
        }

        await applyJunctionDiff(
          tx,
          {
            table: "item_tags",
            fkColumn: "tag_id",
            addIds: addTagIds,
            removeIds: removeTagIds,
          },
          id,
          userId,
          now
        );
        await applyJunctionDiff(
          tx,
          {
            table: "item_tricks",
            fkColumn: "trick_id",
            addIds: addTrickIds,
            removeIds: removeTrickIds,
          },
          id,
          userId,
          now
        );
      });

      trackEvent("item_updated");
    } catch (error: unknown) {
      if (isTypedMutationError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Unknown error updating item";
      throw new Error(`Failed to update item: ${message}`, { cause: error });
    }
  }

  async function deleteItem(id: ItemId): Promise<void> {
    const userId = getUserId();
    const now = new Date().toISOString();

    try {
      await db.writeTransaction(async (tx) => {
        const result = await tx.execute(
          "UPDATE items SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
          [now, now, id, userId]
        );
        if (!result.rowsAffected) {
          throw new ItemNotFoundError();
        }
        await tx.execute(
          "UPDATE item_tags SET deleted_at = ?, updated_at = ? WHERE item_id = ? AND user_id = ? AND deleted_at IS NULL",
          [now, now, id, userId]
        );
        await tx.execute(
          "UPDATE item_tricks SET deleted_at = ?, updated_at = ? WHERE item_id = ? AND user_id = ? AND deleted_at IS NULL",
          [now, now, id, userId]
        );
      });

      trackEvent("item_deleted");
    } catch (error: unknown) {
      if (isTypedMutationError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Unknown error deleting item";
      throw new Error(`Failed to delete item: ${message}`, { cause: error });
    }
  }

  return { createItem, deleteItem, updateItem };
}
