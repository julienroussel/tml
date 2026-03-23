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
  // TODO: locale and theme enums are TypeScript-only — add DB-level CHECK
  // constraints in a future migration. Locale values: en, fr, es, pt, it, de,
  // nl. Theme values: light, dark, system. TypeScript enums provide
  // compile-time safety, but runtime data integrity depends on
  // application-level validation in isLocale() and isTheme().
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
});
