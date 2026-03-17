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

/** Junction tables and their parent FK relationships for ownership validation. */
const JUNCTION_PARENTS: Partial<
  Record<SyncedTableName, { column: string; parentTable: string }[]>
> = {
  routine_tricks: [
    { column: "routine_id", parentTable: "routines" },
    { column: "trick_id", parentTable: "tricks" },
  ],
  practice_session_tricks: [
    { column: "practice_session_id", parentTable: "practice_sessions" },
    { column: "trick_id", parentTable: "tricks" },
  ],
  item_tricks: [
    { column: "item_id", parentTable: "items" },
    { column: "trick_id", parentTable: "tricks" },
  ],
};

function isSyncedTable(table: string): table is SyncedTableName {
  return (SYNCED_TABLES as ReadonlySet<string>).has(table);
}

const quoteId = (id: string): string => `"${id.replaceAll('"', '""')}"`;

/** Known parent table names from JUNCTION_PARENTS for allowlist validation. */
const KNOWN_PARENT_TABLES = new Set(
  Object.values(JUNCTION_PARENTS)
    .flat()
    .map(({ parentTable }) => parentTable)
);

/** HTTP status codes for permanent client errors — retrying won't help. */
const PERMANENT_CLIENT_ERRORS = new Set([400, 404, 409, 422]);

type SqlParam = string | number | boolean | null;

interface NeonApiResponse {
  rows: Record<string, SqlParam>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNeonApiResponse(data: unknown): data is NeonApiResponse {
  if (!(isRecord(data) && "rows" in data)) {
    return false;
  }
  const { rows } = data;
  if (!Array.isArray(rows)) {
    return false;
  }
  for (const row of rows) {
    if (!isRecord(row)) {
      return false;
    }
    for (const value of Object.values(row)) {
      if (!isSqlParam(value)) {
        return false;
      }
    }
  }
  return true;
}

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

/**
 * For junction tables (no user_id column), validates that referenced parent
 * rows belong to the authenticated user. Throws if any parent row is missing
 * or belongs to a different user.
 */
async function validateJunctionOwnership(
  table: SyncedTableName,
  record: Record<string, SqlParam>,
  userId: string,
  apiUrl: string,
  token: string
): Promise<void> {
  const parents = JUNCTION_PARENTS[table];
  if (!parents) {
    return;
  }

  // Collect all FK checks that need validation
  const checks: { fkColumn: string; fkValue: string; parentTable: string }[] =
    [];
  for (const { column: fkColumn, parentTable } of parents) {
    const fkValue = record[fkColumn];
    if (!fkValue || typeof fkValue !== "string") {
      continue;
    }
    checks.push({ fkColumn, fkValue, parentTable });
  }

  if (checks.length === 0) {
    return;
  }

  // Group checks by parent table so we can batch with WHERE id IN (...)
  const byParent = new Map<string, string[]>();
  for (const { fkValue, parentTable } of checks) {
    const existing = byParent.get(parentTable);
    if (existing) {
      existing.push(fkValue);
    } else {
      byParent.set(parentTable, [fkValue]);
    }
  }

  // Issue one batched ownership query per parent table
  await Promise.all(
    [...byParent.entries()].map(async ([parentTable, fkValues]) => {
      // Defense-in-depth: validate parentTable against known allowlist
      if (!KNOWN_PARENT_TABLES.has(parentTable)) {
        throw new Error(`Unknown parent table: ${parentTable}`);
      }
      const placeholders = fkValues.map((_, i) => `$${i + 1}`);
      const params: SqlParam[] = [...fkValues, userId];
      const userIdPlaceholder = `$${params.length}`;

      let checkResponse: Response;
      try {
        checkResponse = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `SELECT "id" FROM ${quoteId(parentTable)} WHERE "id" IN (${placeholders.join(", ")}) AND "user_id" = ${userIdPlaceholder}`,
            params,
          }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error: unknown) {
        throw new Error(
          `Failed to validate ownership of ${parentTable} records [${fkValues.join(", ")}]`,
          { cause: error }
        );
      }
      if (!checkResponse.ok) {
        throw new Error(
          `Ownership check failed for ${parentTable}: ${checkResponse.status}`
        );
      }
      const checkData: unknown = await checkResponse.json();
      if (!isNeonApiResponse(checkData)) {
        throw new Error(
          `Unexpected response from ownership check for ${parentTable}`
        );
      }

      const ownedIds = new Set(
        checkData.rows.map((row) => {
          const id = row.id;
          if (typeof id !== "string") {
            throw new Error(
              `Expected string id from ownership check, got ${typeof id}`
            );
          }
          return id;
        })
      );
      for (const fkValue of fkValues) {
        if (!ownedIds.has(fkValue)) {
          throw new Error(
            `Unauthorized: ${parentTable} ${fkValue} does not belong to user`
          );
        }
      }
    })
  );
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

/**
 * For DELETE on junction tables, fetch the FK columns needed for ownership
 * validation (not SELECT *) since opData may be empty.
 *
 * TOCTOU caveat: There is a small window between the ownership SELECT
 * and the subsequent soft-delete UPDATE where a concurrent mutation could
 * reassign the junction row's FK to a different parent. This is acceptable
 * because (1) UUIDs make accidental collision negligible, (2) the
 * ownership check prevents the common case of unauthorized access, and
 * (3) true atomic row-level locking would require SELECT ... FOR UPDATE
 * inside a serializable transaction, which the Neon Data API does not
 * currently support in a single round-trip.
 */
async function validateJunctionDeleteOwnership(
  table: SyncedTableName,
  rowId: string,
  userId: string,
  neonDataApiUrl: string,
  token: string
): Promise<void> {
  const parents = JUNCTION_PARENTS[table];
  if (!parents) {
    return;
  }

  const fkColumns = parents.map(({ column }) => quoteId(column)).join(", ");
  let fetchResponse: Response;
  try {
    fetchResponse = await fetch(neonDataApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `SELECT ${fkColumns} FROM ${quoteId(table)} WHERE "id" = $1 AND "deleted_at" IS NULL`,
        params: [rowId],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error: unknown) {
    throw new Error(
      `Failed to fetch ${table} record ${rowId} for ownership validation`,
      { cause: error }
    );
  }
  if (!fetchResponse.ok) {
    throw new Error(
      `Failed to fetch junction row for ownership check: ${fetchResponse.status}`
    );
  }
  const fetchData: unknown = await fetchResponse.json();
  if (!isNeonApiResponse(fetchData) || fetchData.rows.length === 0) {
    throw new Error(
      `Junction row ${rowId} not found in ${table} for ownership check`
    );
  }
  const existingRow = fetchData.rows[0];
  // Verify all expected FK columns are present and non-null before
  // ownership validation — a missing FK would silently skip the check.
  for (const { column: fkColumn } of parents) {
    if (!(fkColumn in existingRow) || existingRow[fkColumn] === null) {
      throw new Error(
        `Junction row ${rowId} in ${table} is missing FK column "${fkColumn}" — cannot verify ownership`
      );
    }
  }
  await validateJunctionOwnership(
    table,
    existingRow,
    userId,
    neonDataApiUrl,
    token
  );
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

  // For junction tables (no user_id column), validate that referenced
  // parent rows belong to the authenticated user before allowing mutations.
  if (op.op === UpdateType.PUT || op.op === UpdateType.PATCH) {
    await validateJunctionOwnership(
      table,
      record,
      userId,
      neonDataApiUrl,
      token
    );
  } else if (op.op === UpdateType.DELETE && JUNCTION_PARENTS[table]) {
    await validateJunctionDeleteOwnership(
      table,
      op.id,
      userId,
      neonDataApiUrl,
      token
    );
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

    // TODO: Batch CRUD operations into fewer HTTP requests when the Neon Data API
    // supports multi-statement transactions. Currently each mutation is a separate
    // request, which adds latency proportional to the number of pending changes.
    // Junction table ownership validation (validateJunctionOwnership) adds
    // additional round-trips per mutation — batching should combine these into a
    // single multi-statement request alongside the mutation itself.
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
  JUNCTION_PARENTS,
  validateRecord,
};
