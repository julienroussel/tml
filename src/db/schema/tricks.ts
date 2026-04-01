import { sql } from "drizzle-orm";
import {
  boolean,
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
    effectType: text("effect_type"),
    difficulty: integer(),
    status: text({
      enum: ["new", "learning", "performance_ready", "mastered", "shelved"],
    })
      .default("new")
      .notNull(),
    duration: integer(),
    performanceType: text("performance_type", {
      enum: ["close_up", "parlor", "stage", "street", "virtual"],
    }),
    angleSensitivity: text("angle_sensitivity", {
      enum: ["none", "slight", "moderate", "high"],
    }),
    props: text(),
    music: text(),
    languages: text().array(),
    isCameraFriendly: boolean("is_camera_friendly"),
    isSilent: boolean("is_silent"),
    notes: text(),
    source: text(),
    videoUrl: text("video_url"),
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
