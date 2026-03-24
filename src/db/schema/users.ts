import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { locales } from "@/i18n/config";

export const users = pgTable("users", {
  // defaultRandom() is a safety net; in practice IDs always come from Neon Auth (external provider)
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  displayName: text("display_name"),
  role: text({ enum: ["user", "admin"] })
    .default("user")
    .notNull(),
  locale: text({ enum: locales }).default("en").notNull(),
  theme: text({ enum: ["light", "dark", "system"] })
    .default("system")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`NOW()`),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
});
