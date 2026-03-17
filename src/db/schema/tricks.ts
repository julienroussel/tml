import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const tricks = pgTable(
  "tricks",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    category: text(),
    difficulty: integer(),
    status: text({
      enum: ["new", "learning", "performance_ready", "mastered", "shelved"],
    })
      .default("new")
      .notNull(),
    tags: text().array(),
    notes: text(),
    source: text(),
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
    index("tricks_user_id_idx").on(table.userId).where(sql`deleted_at IS NULL`),
  ]
);
