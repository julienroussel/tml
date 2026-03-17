import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    authKey: text("auth_key").notNull(),
    deviceName: text("device_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("push_subscriptions_user_id_idx").on(table.userId)]
);
