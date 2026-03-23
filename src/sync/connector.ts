import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web";
import { UpdateType } from "@powersync/web";
import { dispatchSyncError } from "./events";
import type { SqlParam, SqlStatement, SyncedTableName } from "./queries";
import {
  buildQuery as buildQueryFromShared,
  coerceOpRecord,
  isSyncedTable,
  OpType,
  SYNCED_COLUMNS,
} from "./queries";

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;
const NEON_DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

/** HTTP status codes for permanent client errors — retrying won't help. */
const PERMANENT_CLIENT_ERRORS = new Set([400, 404, 409, 422]);

/** Adapter: maps @powersync/web UpdateType to the shared OpType string values. */
function buildQuery(
  op: UpdateType,
  table: SyncedTableName,
  id: string,
  record: Record<string, SqlParam>,
  userId: string
): SqlStatement {
  const opMap: Record<UpdateType, OpType> = {
    [UpdateType.PUT]: OpType.PUT,
    [UpdateType.PATCH]: OpType.PATCH,
    [UpdateType.DELETE]: OpType.DELETE,
  };
  return buildQueryFromShared(opMap[op], table, id, record, userId);
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

/** Default handler that logs and dispatches a UI event — consumers can override via createNeonConnector options. */
const defaultUploadErrorHandler: UploadErrorHandler = (error) => {
  console.error(
    `Permanent upload error — mutation dropped: table=${error.op.table} id=${error.op.id} op=${UpdateType[error.op.op]}`,
    error.message
  );

  dispatchSyncError({
    message: error.message,
    table: error.op.table,
    operation: UpdateType[error.op.op],
    status: error.status,
    timestamp: Date.now(),
  });
};

async function handleUploadError(
  response: Response,
  op: CrudOp,
  onPermanentError: UploadErrorHandler
): Promise<void> {
  const body = await response.text().catch(() => "");
  const detailedMessage = `Neon Data API error: ${response.status} ${response.statusText} — ${body}`;

  // Permanent 4xx errors (constraint violations, bad requests) — retrying
  // won't help and would cause an infinite retry loop via PowerSync.
  // 401/403 are excluded: the token may have expired and PowerSync will
  // retry with a fresh token after re-authentication.
  if (PERMANENT_CLIENT_ERRORS.has(response.status)) {
    // Log full error details for debugging but dispatch a generic message
    // to the UI to avoid leaking internal DB details.
    console.error("Upload error:", detailedMessage);
    onPermanentError({ message: "Sync failed", op, status: response.status });
    return;
  }

  console.error("Upload error (will retry):", detailedMessage);
  throw new Error("Sync upload failed — will retry");
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
  const table = op.table;

  if (!isSyncedTable(table)) {
    throw new Error(`Disallowed table: ${table}`);
  }

  // DELETE operations may have undefined opData — skip coercion and
  // validation since the query only needs the row id and user scope.
  const record =
    op.op === UpdateType.DELETE ? {} : coerceOpRecord(op.opData, op.id, table);

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

    // Each mutation is a separate HTTP request. A batch endpoint exists at
    // /api/powersync/batch for reducing round-trips — wiring the connector
    // to use it is tracked in #59.
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

export type { ConnectorOptions, UploadErrorHandler };
export { createNeonConnector, defaultUploadErrorHandler };
