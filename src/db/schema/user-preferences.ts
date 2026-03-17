import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pushEnabled: boolean("push_enabled").default(true),
  emailEnabled: boolean("email_enabled").default(true),
  practiceReminderTime: time("practice_reminder_time"),
  practiceReminderDays: text("practice_reminder_days").array(),
  weeklySummaryEnabled: boolean("weekly_summary_enabled").default(true),
  timezone: text(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`NOW()`),
});
