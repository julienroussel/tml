/** Detail payload for permanent sync upload errors (4xx from Neon Data API). */
interface SyncErrorDetail {
  message: string;
  operation: string;
  status: number;
  table: string;
  timestamp: number;
}

/** Event name dispatched when a mutation is permanently dropped. */
const SYNC_ERROR_EVENT = "sync:permanent-error";

/** Dispatches a typed CustomEvent so the React UI layer can surface the error. */
function dispatchSyncError(detail: SyncErrorDetail): void {
  globalThis.dispatchEvent(
    new CustomEvent<SyncErrorDetail>(SYNC_ERROR_EVENT, { detail })
  );
}

/** Type guard for safely narrowing an Event to a sync error CustomEvent. */
function isSyncErrorEvent(event: Event): event is CustomEvent<SyncErrorDetail> {
  return (
    event instanceof CustomEvent &&
    typeof (event as CustomEvent<SyncErrorDetail>).detail?.table === "string"
  );
}

export type { SyncErrorDetail };
export { dispatchSyncError, isSyncErrorEvent, SYNC_ERROR_EVENT };
