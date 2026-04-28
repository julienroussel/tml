import "server-only";
import type { Database } from "@/db";
import { eventLog } from "@/db/schema/event-log";
import type { UserId } from "@/db/types";
import type { EntityId, EventPayload, EventType } from "./types";

interface LogEventServerArgs<T extends EventType> {
  entityId?: EntityId | null;
  entityType?: string | null;
  payload: EventPayload<T>;
  type: T;
  userId: UserId;
}

/**
 * Records a domain event from a server-side context (server actions, route
 * handlers, auth callbacks). Writes directly to Neon via Drizzle; PowerSync
 * picks the row up on the next sync cycle and propagates it to the client's
 * activity feed.
 *
 * Pass any Drizzle Neon db instance — `getDb()` from `@/db` is the usual
 * choice. Source is fixed to `"server"` so events emitted here can be
 * distinguished from client-emitted events in analytics queries.
 */
async function logEventServer<T extends EventType>(
  db: Database,
  args: LogEventServerArgs<T>
): Promise<void> {
  await db.insert(eventLog).values({
    userId: args.userId,
    eventType: args.type,
    entityType: args.entityType ?? null,
    entityId: args.entityId ?? null,
    payload: args.payload,
    source: "server",
  });
}

export type { LogEventServerArgs };
export { logEventServer };
