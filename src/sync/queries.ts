/**
 * Shared query-building and validation logic for PowerSync mutations.
 *
 * This module is deliberately free of @powersync/web imports so it can be
 * used in both client (connector.ts) and server (batch route) contexts.
 */

// Only client-synced tables are listed here. Server-only tables (users,
// user_preferences) are excluded — the DELETE handler relies on every
// synced table having a deleted_at column for soft-delete.
const SYNCED_TABLE_NAMES = [
  "goals",
  "item_tags",
  "item_tricks",
  "items",
  "performances",
  "practice_session_tricks",
  "practice_sessions",
  "setlist_tricks",
  "setlists",
  "tags",
  "trick_tags",
  "tricks",
] as const;

type SyncedTableName = (typeof SYNCED_TABLE_NAMES)[number];

const SYNCED_TABLES = new Set<SyncedTableName>(SYNCED_TABLE_NAMES);

const SYNCED_COLUMNS = {
  goals: new Set([
    "id",
    "user_id",
    "title",
    "description",
    "target_type",
    "target_value",
    "current_value",
    "deadline",
    "completed_at",
    "trick_id",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  item_tags: new Set([
    "id",
    "user_id",
    "item_id",
    "tag_id",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  item_tricks: new Set([
    "id",
    "user_id",
    "item_id",
    "trick_id",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  items: new Set([
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
    "deleted_at",
  ]),
  performances: new Set([
    "id",
    "user_id",
    "date",
    "venue",
    "event_name",
    "setlist_id",
    "audience_size",
    "audience_type",
    "duration_minutes",
    "rating",
    "notes",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  practice_session_tricks: new Set([
    "id",
    "user_id",
    "practice_session_id",
    "trick_id",
    "repetitions",
    "rating",
    "notes",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  practice_sessions: new Set([
    "id",
    "user_id",
    "date",
    "duration_minutes",
    "mood",
    "notes",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  setlist_tricks: new Set([
    "id",
    "user_id",
    "setlist_id",
    "trick_id",
    "position",
    "transition_notes",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  setlists: new Set([
    "id",
    "user_id",
    "name",
    "description",
    "estimated_duration_minutes",
    "tags",
    "language",
    "environment",
    "requirements",
    "notes",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  tags: new Set([
    "id",
    "user_id",
    "name",
    "color",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  trick_tags: new Set([
    "id",
    "user_id",
    "trick_id",
    "tag_id",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  tricks: new Set([
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
    "deleted_at",
  ]),
} satisfies Record<SyncedTableName, Set<string>>;

/** Operation types matching @powersync/web UpdateType values. */
const OpType = {
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
} as const;

type OpType = (typeof OpType)[keyof typeof OpType];

type SqlParam = string | number | boolean | null;

interface SqlStatement {
  params: SqlParam[];
  query: string;
}

function isSyncedTable(table: string): table is SyncedTableName {
  return (SYNCED_TABLES as ReadonlySet<string>).has(table);
}

function isSqlParam(value: unknown): value is SqlParam {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function quoteId(id: string): string {
  if (!VALID_IDENTIFIER.test(id)) {
    throw new Error(`Invalid identifier: ${id}`);
  }
  return `"${id}"`;
}

function validateRecord(
  table: SyncedTableName,
  record: Record<string, SqlParam>
): void {
  const allowedColumns = SYNCED_COLUMNS[table];
  for (const col of Object.keys(record)) {
    if (!allowedColumns.has(col)) {
      throw new Error(`Disallowed column "${col}" on table "${table}"`);
    }
  }
}

function buildQuery(
  op: OpType,
  table: SyncedTableName,
  id: string,
  record: Record<string, SqlParam>,
  userId: string
): SqlStatement {
  const quotedTable = quoteId(table);

  // Validate record columns for operations that use them in the query.
  // DELETE only needs the row id and user scope, so it skips validation.
  if (op !== OpType.DELETE) {
    validateRecord(table, record);
  }

  switch (op) {
    case OpType.PUT: {
      const entries = Object.entries(record).filter(
        ([col]) => col !== "deleted_at" && col !== "updated_at"
      );
      const columns = entries.map(([col]) => col);
      const values: SqlParam[] = entries.map(([, val]) => val);
      const quotedColumns = columns.map(quoteId);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const conflictSetClauses = entries
        .filter(([col]) => col !== "id")
        .map(([col]) => `${quoteId(col)} = EXCLUDED.${quoteId(col)}`);

      // Always set updated_at to server time on conflict
      conflictSetClauses.push('"updated_at" = NOW()');

      // Ensure soft-deleted rows are resurrected on re-insert
      if (!entries.some(([col]) => col === "deleted_at")) {
        conflictSetClauses.push('"deleted_at" = NULL');
      }

      // Scope the upsert to the current user's rows when the table has a
      // user_id column. Without this WHERE clause, a crafted PUT with another
      // user's row ID could overwrite that row.
      const hasUserId = SYNCED_COLUMNS[table].has("user_id");
      let userIdWhereClause = "";
      if (hasUserId) {
        values.push(userId);
        userIdWhereClause = ` WHERE ${quotedTable}."user_id" = $${values.length}`;
      }

      return {
        params: values,
        query: `INSERT INTO ${quotedTable} (${quotedColumns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT ("id") DO UPDATE SET ${conflictSetClauses.join(", ")}${userIdWhereClause}`,
      };
    }
    case OpType.PATCH: {
      const entries: [string, SqlParam][] = Object.entries(record).filter(
        ([key]) => key !== "id" && key !== "deleted_at"
      );
      const nonTimestampEntries = entries.filter(
        ([col]) => col !== "updated_at"
      );
      const setClauses = nonTimestampEntries.map(
        ([col], i) => `${quoteId(col)} = $${i + 1}`
      );
      setClauses.push(`"updated_at" = NOW()`);
      const params: SqlParam[] = [
        ...nonTimestampEntries.map(([, val]) => val),
        id,
      ];
      let whereClause = `WHERE "id" = $${nonTimestampEntries.length + 1}`;
      const hasUserId = SYNCED_COLUMNS[table].has("user_id");
      if (hasUserId) {
        params.push(userId);
        whereClause += ` AND "user_id" = $${params.length}`;
      }
      return {
        params,
        query: `UPDATE ${quotedTable} SET ${setClauses.join(", ")} ${whereClause}`,
      };
    }
    case OpType.DELETE: {
      const params: SqlParam[] = [id];
      let whereClause = 'WHERE "id" = $1';
      const hasUserId = SYNCED_COLUMNS[table].has("user_id");
      if (hasUserId) {
        params.push(userId);
        whereClause += ` AND "user_id" = $${params.length}`;
      }
      return {
        params,
        query: `UPDATE ${quotedTable} SET "deleted_at" = NOW(), "updated_at" = NOW() ${whereClause}`,
      };
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown operation type: ${_exhaustive}`);
    }
  }
}

function coerceOpRecord(
  opData: Record<string, unknown> | undefined,
  id: string,
  table: SyncedTableName
): Record<string, SqlParam> {
  if (!opData) {
    throw new Error(
      `Missing opData for table "${table}" (id: ${id}) — cannot build record`
    );
  }
  const rawRecord: Record<string, unknown> = { ...opData, id };
  const record: Record<string, SqlParam> = {};
  for (const [key, value] of Object.entries(rawRecord)) {
    if (!isSqlParam(value)) {
      throw new Error(
        `Non-primitive value for column "${key}" on table "${table}": ${typeof value}`
      );
    }
    record[key] = value;
  }
  return record;
}

export type { SqlParam, SqlStatement, SyncedTableName };
export {
  buildQuery,
  coerceOpRecord,
  isSqlParam,
  isSyncedTable,
  OpType,
  quoteId,
  SYNCED_COLUMNS,
  validateRecord,
};
