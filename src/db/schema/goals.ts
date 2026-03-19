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
import { tricks } from "./tricks";
import { users } from "./users";

export const goals = pgTable(
  "goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    targetType: text("target_type", {
      enum: ["practice_streak", "trick_mastery", "show_count", "custom"],
    }),
    targetValue: integer("target_value"),
    currentValue: integer("current_value").default(0),
    deadline: date(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // FK cascade SET NULL bumps updated_at via DB trigger (migration 0007).
    trickId: uuid("trick_id").references(() => tricks.id, {
      onDelete: "set null",
    }),
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
    index("goals_user_id_idx").on(table.userId).where(sql`deleted_at IS NULL`),
    index("goals_trick_id_idx")
      .on(table.trickId)
      .where(sql`deleted_at IS NULL`),
  ]
);
