import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const eventLog = pgTable(
  "event_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    // Paired-NULL invariant: entity_type and entity_id must both be NULL or
    // both be NOT NULL. Enforced at the DB layer via the
    // event_log_entity_pair_check CHECK constraint in migration 0018.
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    payload: jsonb().notNull().default({}),
    source: text({ enum: ["client", "server"] })
      .notNull()
      .default("client"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`NOW()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("event_log_user_id_created_at_idx")
      .on(table.userId, table.createdAt)
      .where(sql`deleted_at IS NULL`),
    index("event_log_event_type_idx")
      .on(table.eventType, table.createdAt)
      .where(sql`deleted_at IS NULL`),
    // source must be 'client' or 'server' — server-side trust label.
    // Drizzle's text({ enum: [...] }) is a TS-narrowing helper only; this
    // CHECK is what actually enforces the invariant at the DB layer.
    check(
      "event_log_source_check",
      sql`${table.source} IN ('client', 'server')`
    ),
    // Paired-NULL invariant on (entity_type, entity_id).
    check(
      "event_log_entity_pair_check",
      sql`(${table.entityType} IS NULL AND ${table.entityId} IS NULL) OR (${table.entityType} IS NOT NULL AND ${table.entityId} IS NOT NULL)`
    ),
  ]
);
