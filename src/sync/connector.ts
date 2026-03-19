import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web";
import { UpdateType } from "@powersync/web";

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;
const NEON_DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

// Only client-synced tables are listed here. Server-only tables (users,
// user_preferences) are excluded — the DELETE handler relies on every
// synced table having a deleted_at column for soft-delete.
const SYNCED_TABLE_NAMES = [
  "goals",
  "item_tricks",
  "items",
  "performances",
  "practice_session_tricks",
  "practice_sessions",
  "routine_tricks",
  "routines",
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
    "routine_id",
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
  routine_tricks: new Set([
    "id",
    "user_id",
    "routine_id",
    "trick_id",
    "position",
    "transition_notes",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  routines: new Set([
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
  tricks: new Set([
    "id",
    "user_id",
    "name",
    "description",
    "category",
    "difficulty",
    "status",
    "tags",
    "notes",
    "source",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
} satisfies Record<SyncedTableName, Set<string>>;

function isSyncedTable(table: string): table is SyncedTableName {
  return (SYNCED_TABLES as ReadonlySet<string>).has(table);
}

const quoteId = (id: string): string => `"${id.replaceAll('"', '""')}"`;

/** HTTP status codes for permanent client errors — retrying won't help. */
const PERMANENT_CLIENT_ERRORS = new Set([400, 404, 409, 422]);

type SqlParam = string | number | boolean | null;

function isSqlParam(value: unknown): value is SqlParam {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

interface SqlStatement {
  params: SqlParam[];
  query: string;
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
  op: UpdateType,
  table: SyncedTableName,
  id: string,
  record: Record<string, SqlParam>,
  userId: string
): SqlStatement {
  const quotedTable = quoteId(table);

  switch (op) {
    case UpdateType.PUT: {
      const entries = Object.entries(record);
      const columns = entries.map(([col]) => col);
      const values: SqlParam[] = entries.map(([, val]) => val);
      const quotedColumns = columns.map(quoteId);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const conflictSetClauses = entries
        .filter(([col]) => col !== "id")
        .map(([col]) =>
          col === "updated_at"
            ? `${quoteId(col)} = NOW()`
            : `${quoteId(col)} = EXCLUDED.${quoteId(col)}`
        );

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
    case UpdateType.PATCH: {
      const entries: [string, SqlParam][] = Object.entries(record).filter(
        ([key]) => key !== "id"
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
    case UpdateType.DELETE: {
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
  table: string
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

// Intentionally not using CrudEntry from @powersync/web — CrudEntry is a class
// with methods (toJSON, equals, hashCode) that we don't need. This plain
// interface keeps the connector logic decoupled from the SDK's internals.
interface CrudOp {
  id: string;
  op: UpdateType;
  opData?: Record<string, unknown>;
  table: string;
}

/** Callback invoked when a mutation is permanently dropped due to a 4xx error. */
type UploadErrorHandler = (error: {
  message: string;
  op: CrudOp;
  status: number;
}) => void;

/** Default handler that only logs — consumers can override via createNeonConnector options. */
const defaultUploadErrorHandler: UploadErrorHandler = (error) => {
  console.error(
    `Permanent upload error — mutation dropped: table=${error.op.table} id=${error.op.id} op=${UpdateType[error.op.op]}`,
    error.message
  );
};

async function handleUploadError(
  response: Response,
  op: CrudOp,
  onPermanentError: UploadErrorHandler
): Promise<void> {
  const body = await response.text().catch(() => "");
  const message = `Neon Data API error: ${response.status} ${response.statusText} — ${body}`;

  // Permanent 4xx errors (constraint violations, bad requests) — retrying
  // won't help and would cause an infinite retry loop via PowerSync.
  // 401/403 are excluded: the token may have expired and PowerSync will
  // retry with a fresh token after re-authentication.
  if (PERMANENT_CLIENT_ERRORS.has(response.status)) {
    onPermanentError({ message, op, status: response.status });
    return;
  }

  throw new Error(message);
}

interface ConnectorOptions {
  /** Returns the authenticated user's ID for scoping mutations. */
  getUserId?: () => Promise<string | null>;
  /** Called when a mutation is permanently dropped (4xx). Defaults to console.error. */
  onUploadError?: UploadErrorHandler;
}

async function processOperation(
  op: CrudOp,
  userId: string,
  neonDataApiUrl: string,
  token: string,
  onPermanentError: UploadErrorHandler
): Promise<void> {
  const record = coerceOpRecord(op.opData, op.id, op.table);
  const table = op.table;

  if (!isSyncedTable(table)) {
    throw new Error(`Disallowed table: ${table}`);
  }

  validateRecord(table, record);

  // Prevent forged user_id — always overwrite with the authenticated user
  // so the client cannot claim another user's ownership.
  const hasUserId = SYNCED_COLUMNS[table].has("user_id");
  if (hasUserId) {
    record.user_id = userId;
  }

  const { query, params } = buildQuery(op.op, table, op.id, record, userId);

  const response = await fetch(neonDataApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, params }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    await handleUploadError(response, op, onPermanentError);
  }
}

/**
 * Creates a PowerSync connector that uses Neon Auth tokens for authentication
 * and the Neon Data API for uploading mutations.
 */
function createNeonConnector(
  getToken: () => Promise<string | null>,
  options?: ConnectorOptions
): PowerSyncBackendConnector {
  if (!POWERSYNC_URL) {
    throw new Error(
      "NEXT_PUBLIC_POWERSYNC_URL is required but not set in environment"
    );
  }
  if (!NEON_DATA_API_URL) {
    throw new Error(
      "NEXT_PUBLIC_NEON_DATA_API_URL is required but not set in environment"
    );
  }

  const powerSyncUrl = POWERSYNC_URL;
  const neonDataApiUrl = NEON_DATA_API_URL;

  async function fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const token = await getToken();
    if (!token) {
      return null;
    }

    return { endpoint: powerSyncUrl, token };
  }

  async function uploadData(
    database: AbstractPowerSyncDatabase
  ): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    const token = await getToken();
    if (!token) {
      throw new Error("Not authenticated — cannot upload data");
    }

    const onPermanentError =
      options?.onUploadError ?? defaultUploadErrorHandler;
    const userId = options?.getUserId ? await options.getUserId() : null;
    if (!userId) {
      throw new Error("Unauthorized: userId is required for mutations");
    }

    // Each mutation is a separate HTTP request — see #59 for batching plan.
    //
    // Idempotency on retry (PowerSync replays the entire transaction on failure):
    // - PUT: Uses INSERT ... ON CONFLICT (upsert) — fully idempotent.
    // - DELETE: Soft-delete sets deleted_at — re-applying is a no-op UPDATE.
    // - PATCH: Uses UPDATE ... SET with server-side NOW() for updated_at.
    //   Re-applying a PATCH after a partial failure may overwrite a concurrent
    //   write with stale column values, but this is acceptable under the sync
    //   engine's last-write-wins conflict resolution strategy.
    try {
      for (const op of transaction.crud) {
        await processOperation(
          op,
          userId,
          neonDataApiUrl,
          token,
          onPermanentError
        );
      }

      await transaction.complete();
    } catch (error: unknown) {
      console.error("PowerSync upload error:", error);
      throw error;
    }
  }

  return { fetchCredentials, uploadData };
}

export type {
  ConnectorOptions,
  SqlParam,
  SqlStatement,
  SyncedTableName,
  UploadErrorHandler,
};
export {
  buildQuery,
  createNeonConnector,
  defaultUploadErrorHandler,
  isSqlParam,
  isSyncedTable,
  validateRecord,
};
