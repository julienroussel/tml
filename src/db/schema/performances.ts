import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { routines } from "./routines";
import { users } from "./users";

export const performances = pgTable(
  "performances",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date().notNull(),
    venue: text(),
    eventName: text("event_name"),
    // IMPORTANT: When implementing updated_at triggers (#61), ensure SET NULL
    // cascades on this FK also bump updated_at so PowerSync detects the change.
    routineId: uuid("routine_id").references(() => routines.id, {
      onDelete: "set null",
    }),
    audienceSize: integer("audience_size"),
    audienceType: text("audience_type", {
      enum: [
        "birthday",
        "corporate",
        "other",
        "private",
        "street",
        "theater",
        "wedding",
      ],
    }),
    durationMinutes: integer("duration_minutes"),
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
    index("performances_user_id_idx")
      .on(table.userId)
      .where(sql`deleted_at IS NULL`),
    index("performances_routine_id_idx")
      .on(table.routineId)
      .where(sql`deleted_at IS NULL`),
    index("performances_user_id_date_idx")
      .on(table.userId, table.date)
      .where(sql`deleted_at IS NULL`),
  ]
);
