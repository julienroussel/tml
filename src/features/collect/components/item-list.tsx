"use client";

import { useTranslations } from "next-intl";
import type { ItemId } from "@/db/types";
import type { ItemWithRelations } from "../types";
import { ItemCard } from "./item-card";

interface ItemListProps {
  items: ItemWithRelations[];
  onDelete: (id: ItemId) => void;
  onEdit: (id: ItemId) => void;
  /**
   * True when the item_tags join query has errored. Forwarded to every
   * ItemCard so each shows a muted indicator badge in place of its tag list
   * (issue #267).
   */
  tagsError?: boolean;
  /**
   * True when the item_tricks join query has errored. Forwarded to every
   * ItemCard so each shows a muted indicator in place of its linked-tricks
   * count (issue #267).
   */
  tricksError?: boolean;
}

/**
 * Renders item cards in a responsive grid layout.
 *
 * Stateless presentational component -- all interaction is delegated
 * to the parent via `onEdit` and `onDelete` callbacks.
 */
export function ItemList({
  items,
  onEdit,
  onDelete,
  tagsError,
  tricksError,
}: ItemListProps): React.ReactElement {
  const t = useTranslations("collect");

  return (
    <ul
      aria-label={t("title")}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard
            item={item}
            onDelete={onDelete}
            onEdit={onEdit}
            tagsError={tagsError}
            tricksError={tricksError}
          />
        </li>
      ))}
    </ul>
  );
}
