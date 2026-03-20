import { sql } from "drizzle-orm";
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tricks } from "./tricks";
import { users } from "./users";

export const items = pgTable(
  "items",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: text({
      enum: ["prop", "book", "gimmick", "dvd", "download", "other"],
    }).notNull(),
    description: text(),
    brand: text(),
    condition: text({ enum: ["new", "good", "worn", "needs_repair"] }),
    location: text(),
    notes: text(),
    purchaseDate: date("purchase_date"),
    purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
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
    index("items_user_id_idx").on(table.userId).where(sql`deleted_at IS NULL`),
  ]
);

export const itemTricks = pgTable(
  "item_tricks",
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
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "no action" }),
    trickId: uuid("trick_id")
      .notNull()
      .references(() => tricks.id, { onDelete: "no action" }),
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
    index("item_tricks_user_id_idx")
      .on(table.userId)
      .where(sql`deleted_at IS NULL`),
    index("item_tricks_item_id_idx")
      .on(table.itemId)
      .where(sql`deleted_at IS NULL`),
    index("item_tricks_trick_id_idx")
      .on(table.trickId)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex("item_tricks_item_trick_idx")
      .on(table.itemId, table.trickId)
      .where(sql`deleted_at IS NULL`),
  ]
);
