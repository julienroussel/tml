import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web";
import { UpdateType } from "@powersync/web";
import { dispatchSyncError } from "./events";
import { isSyncedTable, OpType } from "./queries";

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;

const BATCH_UPLOAD_PATH = "/api/powersync/batch";

/** Maximum operations per batch request — matches the server-side limit. */
const BATCH_SIZE = 1000;

/** Maps PowerSync SDK UpdateType enum to the shared OpType string values. */
const UPDATE_TYPE_TO_OP: Record<UpdateType, OpType> = {
  [UpdateType.PUT]: OpType.PUT,
  [UpdateType.PATCH]: OpType.PATCH,
  [UpdateType.DELETE]: OpType.DELETE,
};

// Intentionally not using CrudEntry from @powersync/web — CrudEntry is a class
// with methods (toJSON, equals, hashCode) that we don't need. This plain
// interface keeps the connector logic decoupled from the SDK's internals.
interface CrudOp {
  id: string;
  op: UpdateType;
  opData?: Record<string, unknown>;
  table: string;
}

interface BatchOperation {
  id: string;
  op: OpType;
  opData?: Record<string, unknown>;
  table: string;
}

interface BatchResponseResult {
  error?: string;
  index: number;
  status: number;
}

function isBatchResponseResult(value: unknown): value is BatchResponseResult {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.index === "number" && typeof record.status === "number";
}

/** Callback invoked when a mutation is permanently dropped due to an error. */
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

interface ConnectorOptions {
  /** Called when a mutation is permanently dropped (422). Defaults to console.error + UI event. */
  onUploadError?: UploadErrorHandler;
}

/**
 * Filters out operations targeting disallowed tables (reporting them as
 * permanent errors) and maps the remaining ops to the batch endpoint format.
 *
 * Client-side table filtering is required because the batch endpoint rejects
 * the entire request (400) if any operation targets a disallowed table.
 */
function toBatchOperations(
  crud: CrudOp[],
  onPermanentError: UploadErrorHandler
): { batchOps: BatchOperation[]; originalOps: CrudOp[] } {
  const batchOps: BatchOperation[] = [];
  const originalOps: CrudOp[] = [];

  for (const op of crud) {
    if (!isSyncedTable(op.table)) {
      onPermanentError({
        message: `Disallowed table: ${op.table}`,
        op,
        status: 422,
      });
      continue;
    }

    batchOps.push({
      id: op.id,
      op: UPDATE_TYPE_TO_OP[op.op],
      table: op.table,
      ...(op.opData !== undefined && { opData: op.opData }),
    });
    originalOps.push(op);
  }

  return { batchOps, originalOps };
}

/** Extracts validated results from the batch response JSON. */
function parseBatchResults(json: unknown): BatchResponseResult[] {
  if (json === null || typeof json !== "object" || !("results" in json)) {
    return [];
  }
  const raw = (json as { results: unknown }).results;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isBatchResponseResult);
}

/** Reports per-operation permanent errors from the batch response. */
function reportPermanentErrors(
  results: BatchResponseResult[],
  originalOps: CrudOp[],
  onPermanentError: UploadErrorHandler
): void {
  for (const result of results) {
    if (result.status !== 422) {
      continue;
    }
    const originalOp = originalOps[result.index];
    if (originalOp) {
      onPermanentError({
        message: result.error ?? "Permanent error",
        op: originalOp,
        status: 422,
      });
    }
  }
}

/**
 * Sends a batch of operations to the server and processes the response.
 *
 * - 401 → throws (transient — PowerSync retries after re-auth)
 * - 500 → throws (transient — PowerSync retries, idempotent ops are safe)
 * - 200 with per-op 422 → reports each as permanent error
 */
async function sendAndProcessBatch(
  operations: BatchOperation[],
  originalOps: CrudOp[],
  onPermanentError: UploadErrorHandler
): Promise<void> {
  const response = await fetch(BATCH_UPLOAD_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations }),
    credentials: "same-origin",
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 401) {
    throw new Error("Unauthorized — will retry after re-authentication");
  }

  // Non-401 4xx errors are permanent — retrying won't help. Report all
  // operations as failed so PowerSync drops them from the queue.
  if (response.status >= 400 && response.status < 500) {
    const body = await response.text().catch(() => "");
    console.error("Batch upload permanently rejected:", response.status, body);
    for (const op of originalOps) {
      onPermanentError({
        message: `Server rejected batch (${response.status})`,
        op,
        status: response.status,
      });
    }
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Batch upload failed:", response.status, body);
    throw new Error("Batch upload failed — will retry");
  }

  const json: unknown = await response.json();
  const results = parseBatchResults(json);
  reportPermanentErrors(results, originalOps, onPermanentError);
}

/**
 * Creates a PowerSync connector that uses Neon Auth tokens for authentication
 * and the batch endpoint for uploading mutations.
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

  const powerSyncUrl = POWERSYNC_URL;

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

    const onPermanentError =
      options?.onUploadError ?? defaultUploadErrorHandler;

    const { batchOps, originalOps } = toBatchOperations(
      transaction.crud,
      onPermanentError
    );

    // All operations were filtered out (disallowed tables) — nothing to send.
    if (batchOps.length === 0) {
      await transaction.complete();
      return;
    }

    // Idempotency on retry (PowerSync replays the entire transaction on failure):
    // - PUT: Uses INSERT ... ON CONFLICT (upsert) — fully idempotent.
    // - DELETE: Soft-delete sets deleted_at — re-applying is a no-op UPDATE.
    // - PATCH: Uses UPDATE ... SET with server-side NOW() for updated_at.
    //   Re-applying a PATCH after a partial failure may overwrite a concurrent
    //   write with stale column values, but this is acceptable under the sync
    //   engine's last-write-wins conflict resolution strategy.
    try {
      // Chunk into batches of BATCH_SIZE to stay within the server limit.
      for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
        const chunk = batchOps.slice(i, i + BATCH_SIZE);
        const chunkOriginals = originalOps.slice(i, i + BATCH_SIZE);
        await sendAndProcessBatch(chunk, chunkOriginals, onPermanentError);
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
