"use client";

import { useTranslations } from "next-intl";
import type { ItemId } from "@/db/types";
import type { ItemWithRelations } from "../types";
import { ItemCard } from "./item-card";

interface ItemListProps {
  items: ItemWithRelations[];
  onDelete: (id: ItemId) => void;
  onEdit: (id: ItemId) => void;
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
}: ItemListProps): React.ReactElement {
  const t = useTranslations("collect");

  return (
    <ul
      aria-label={t("title")}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} onDelete={onDelete} onEdit={onEdit} />
        </li>
      ))}
    </ul>
  );
}
