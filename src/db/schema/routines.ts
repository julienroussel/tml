import { sql } from "drizzle-orm";
import {
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

export const routines = pgTable(
  "routines",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    tags: text().array(),
    language: text(),
    environment: text({
      enum: ["close_up", "parlor", "stage", "any"],
    }),
    requirements: text().array(),
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
    index("routines_user_id_idx")
      .on(table.userId)
      .where(sql`deleted_at IS NULL`),
  ]
);

export const routineTricks = pgTable(
  "routine_tricks",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // NO ACTION prevents the hard-delete cleanup job (#55) from physically
    // removing a parent while junction rows still reference it. Unlike
    // RESTRICT, NO ACTION defers the check to statement end, which allows
    // user account deletion to cascade correctly through both user_id and
    // entity FK paths. The cleanup job must soft-delete junctions first
    // (creating sync tombstones), then hard-delete in the correct order.
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "no action" }),
    trickId: uuid("trick_id")
      .notNull()
      .references(() => tricks.id, { onDelete: "no action" }),
    position: integer().notNull(),
    transitionNotes: text("transition_notes"),
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
    index("routine_tricks_user_id_idx")
      .on(table.userId)
      .where(sql`deleted_at IS NULL`),
    index("routine_tricks_routine_id_idx")
      .on(table.routineId)
      .where(sql`deleted_at IS NULL`),
    index("routine_tricks_trick_id_idx")
      .on(table.trickId)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex("routine_tricks_routine_position_idx")
      .on(table.routineId, table.position)
      .where(sql`deleted_at IS NULL`),
  ]
);
