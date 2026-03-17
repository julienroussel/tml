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
    // CASCADE is safe here because parent entities use soft-delete (setting
    // deleted_at), which does not trigger ON DELETE CASCADE. Hard-deletes only
    // occur during full user account removal.
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    trickId: uuid("trick_id")
      .notNull()
      .references(() => tricks.id, { onDelete: "cascade" }),
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
