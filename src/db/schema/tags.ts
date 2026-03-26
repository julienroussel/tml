import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tricks } from "./tricks";
import { users } from "./users";

export const tags = pgTable(
  "tags",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text(),
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
    index("tags_user_id_idx").on(table.userId).where(sql`deleted_at IS NULL`),
    uniqueIndex("tags_user_name_idx")
      .on(table.userId, sql`lower(name)`)
      .where(sql`deleted_at IS NULL`),
  ]
);

export const trickTags = pgTable(
  "trick_tags",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // NO ACTION prevents the hard-delete cleanup job from physically
    // removing a parent while junction rows still reference it. The cleanup
    // must soft-delete junctions first (creating sync tombstones), then
    // hard-delete in the correct order.
    trickId: uuid("trick_id")
      .notNull()
      .references(() => tricks.id, { onDelete: "no action" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "no action" }),
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
    index("trick_tags_user_id_idx")
      .on(table.userId)
      .where(sql`deleted_at IS NULL`),
    index("trick_tags_trick_id_idx")
      .on(table.trickId)
      .where(sql`deleted_at IS NULL`),
    index("trick_tags_tag_id_idx")
      .on(table.tagId)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex("trick_tags_trick_tag_idx")
      .on(table.trickId, table.tagId)
      .where(sql`deleted_at IS NULL`),
  ]
);
