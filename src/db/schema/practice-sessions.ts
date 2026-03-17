import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tricks } from "./tricks";
import { users } from "./users";

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date().notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    mood: integer(),
    notes: text(),
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
    index("practice_sessions_user_id_idx")
      .on(table.userId)
      .where(sql`deleted_at IS NULL`),
    index("practice_sessions_user_id_date_idx")
      .on(table.userId, table.date)
      .where(sql`deleted_at IS NULL`),
  ]
);

export const practiceSessionTricks = pgTable(
  "practice_session_tricks",
  {
    id: uuid().primaryKey().defaultRandom(),
    // CASCADE is safe here because parent entities use soft-delete (setting
    // deleted_at), which does not trigger ON DELETE CASCADE. Hard-deletes only
    // occur during full user account removal.
    practiceSessionId: uuid("practice_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    trickId: uuid("trick_id")
      .notNull()
      .references(() => tricks.id, { onDelete: "cascade" }),
    repetitions: integer(),
    rating: integer(),
    notes: text(),
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
    index("practice_session_tricks_practice_session_id_idx")
      .on(table.practiceSessionId)
      .where(sql`deleted_at IS NULL`),
    index("practice_session_tricks_trick_id_idx")
      .on(table.trickId)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex("practice_session_tricks_session_trick_idx")
      .on(table.practiceSessionId, table.trickId)
      .where(sql`deleted_at IS NULL`),
  ]
);
