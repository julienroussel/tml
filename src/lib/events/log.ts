import type { Transaction } from "@powersync/common";
import type { UserId } from "@/db/types";
import { reportEventLogFailure } from "./report-failure";
import type {
  EntityId,
  EventLogInsertParams,
  EventPayload,
  EventType,
} from "./types";
import { EVENT_LOG_INSERT_SQL } from "./types";

interface LogEventArgs<T extends EventType> {
  entityId?: EntityId | null;
  entityType?: string | null;
  /**
   * Override the timestamp used for both `created_at` and `updated_at`.
   * Defaults to `new Date().toISOString()`. Pass the same value used for the
   * surrounding mutation row so the event row carries the action's "as-of"
   * time even when written offline and replayed days later.
   */
  now?: string;
  payload: EventPayload<T>;
  type: T;
  userId: UserId;
}

/**
 * Records a domain event in the local PowerSync `event_log` table inside an
 * existing write transaction. The event row is co-located with the surrounding
 * mutation so a successful event rides the same PowerSync upload queue and
 * replays through Neon together; a failing event must NOT roll the parent
 * mutation back — wrap calls with {@link safeLogEvent} so the dual-sink stays
 * best-effort on the event side.
 *
 * Call this from inside an existing `db.writeTransaction(async (tx) => {...})`.
 */
async function logEvent<T extends EventType>(
  tx: Transaction,
  args: LogEventArgs<T>
): Promise<void> {
  const id = crypto.randomUUID();
  const now = args.now ?? new Date().toISOString();
  const params: EventLogInsertParams = [
    id,
    args.userId,
    args.type,
    args.entityType ?? null,
    args.entityId ?? null,
    JSON.stringify(args.payload),
    "client",
    now,
    now,
  ];
  await tx.execute(EVENT_LOG_INSERT_SQL, [...params]);
}

/**
 * Best-effort wrapper around {@link logEvent}: catches event-log failures and
 * routes them through {@link reportEventLogFailure} so an event-log outage,
 * CHECK violation, or schema mismatch never breaks the surrounding mutation.
 *
 * Use this from every domain mutation hook — the parent `writeTransaction`
 * commits whatever state was written before the throw, which is the intended
 * dual-sink behavior (primary mutation is the source of truth, event log is
 * the canonical activity history but not load-bearing for correctness).
 */
async function safeLogEvent<T extends EventType>(
  tx: Transaction,
  args: LogEventArgs<T>
): Promise<void> {
  try {
    await logEvent(tx, args);
  } catch (logError: unknown) {
    reportEventLogFailure(logError, {
      userId: args.userId,
      type: args.type,
    });
  }
}

export type { LogEventArgs };
export { logEvent, safeLogEvent };
