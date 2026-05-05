"use client";

import { useTranslations } from "next-intl";
import type { ItemId, TrickId } from "@/db/types";
import type { TrickWithTags } from "../types";
import { TrickCard } from "./trick-card";

interface TrickListProps {
  itemMap?: Map<TrickId, { id: ItemId; name: string }[]>;
  /**
   * True when the trick_items join query has errored. When true, TrickCard
   * shows a muted indicator badge so the user can distinguish "no linked
   * items" from "failed to load linked items" (issue #218 follow-up).
   */
  linkedItemsError?: boolean;
  onDelete: (id: TrickId) => void;
  onEdit: (id: TrickId) => void;
  tricks: TrickWithTags[];
}

/**
 * Renders trick cards in a responsive grid layout.
 *
 * Stateless presentational component -- all interaction is delegated
 * to the parent via `onEdit` and `onDelete` callbacks.
 */
export function TrickList({
  tricks,
  onEdit,
  onDelete,
  itemMap,
  linkedItemsError,
}: TrickListProps): React.ReactElement {
  const t = useTranslations("repertoire");

  return (
    <ul
      aria-label={t("title")}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {tricks.map((trick) => (
        <li key={trick.id}>
          <TrickCard
            linkedItems={itemMap?.get(trick.id)}
            linkedItemsError={linkedItemsError}
            onDelete={onDelete}
            onEdit={onEdit}
            trick={trick}
          />
        </li>
      ))}
    </ul>
  );
}
