"use client";

import { useQuery } from "@powersync/react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ItemId, TagId, TrickId } from "@/db/types";
import { useHydratedSelection } from "@/hooks/use-hydrated-selection";
import { useTagMutations } from "../hooks/use-tag-mutations";
import { useTags } from "../hooks/use-tags";
import { useTrick } from "../hooks/use-trick";
import { useTrickCategories } from "../hooks/use-trick-categories";
import { useTrickEffectTypes } from "../hooks/use-trick-effect-types";
import {
  getMutationErrorKey,
  useTrickMutations,
} from "../hooks/use-trick-mutations";
import { useTricks } from "../hooks/use-tricks";
import type { TrickFormValues } from "../schema";
import type { ParsedTag, TrickWithTags } from "../types";
import { TrickDeleteDialog } from "./trick-delete-dialog";
import { TrickEmptyState } from "./trick-empty-state";
import { TrickFilters } from "./trick-filters";
import { TrickFormSheet } from "./trick-form-sheet";
import { TrickList } from "./trick-list";

/** Maps kebab-case sort values from TrickFilters to snake_case for useTricks. */
type FilterSortValue =
  | "name-asc"
  | "name-desc"
  | "newest"
  | "oldest"
  | "difficulty"
  | "status";

type HookSortValue =
  | "name_asc"
  | "name_desc"
  | "newest"
  | "oldest"
  | "difficulty"
  | "status";

const SORT_MAP: Record<FilterSortValue, HookSortValue> = {
  "name-asc": "name_asc",
  "name-desc": "name_desc",
  newest: "newest",
  oldest: "oldest",
  difficulty: "difficulty",
  status: "status",
};

/** Row shape returned by the trick_tags + tags join query. */
interface TrickTagRow {
  color: string | null;
  tag_id: string;
  tag_name: string;
  trick_id: string;
}

/** Row shape returned by the item_tricks + items join query. */
interface TrickItemRow {
  item_id: ItemId;
  item_name: string;
  trick_id: TrickId;
}

/** Debounce delay for the search input (milliseconds). */
const SEARCH_DEBOUNCE_MS = 300;

/** Stable toast id for the editing-trick load error (separate so it doesn't clobber the relations toast). */
const LOAD_EDIT_TRICK_ERROR_TOAST_ID = "repertoire-load-edit-trick-error";

/**
 * Main orchestration component for the repertoire feature.
 *
 * Manages all state (filters, sheet, delete dialog, tag selection)
 * and wires up data hooks with child components.
 */
export function RepertoireView(): React.ReactElement {
  const t = useTranslations("repertoire");

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<FilterSortValue>("newest");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  // ---------------------------------------------------------------------------
  // Sheet state
  // ---------------------------------------------------------------------------
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTrickId, setEditingTrickId] = useState<TrickId | null>(null);

  // ---------------------------------------------------------------------------
  // Delete dialog state
  // ---------------------------------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTrickId, setDeletingTrickId] = useState<TrickId | null>(null);

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------
  const { tricks } = useTricks({
    search: debouncedSearch,
    status: statusFilter,
    category: categoryFilter,
    sort: SORT_MAP[sort],
  });

  const {
    trick: editingTrick,
    error: editingTrickError,
    isLoading: editingTrickLoading,
  } = useTrick(editingTrickId);
  const { tags } = useTags();
  const { createTrick, updateTrick, deleteTrick } = useTrickMutations();
  const { createTag } = useTagMutations();
  const categories = useTrickCategories();
  const effectTypes = useTrickEffectTypes();

  // ---------------------------------------------------------------------------
  // Trick-tags join query (build a Map<trickId, ParsedTag[]>)
  // ---------------------------------------------------------------------------
  const {
    data: trickTagRows,
    error: trickTagError,
    isLoading: trickTagsLoading,
  } = useQuery<TrickTagRow>(
    `SELECT tt.trick_id, t.id AS tag_id, t.name AS tag_name, t.color
     FROM trick_tags tt
     JOIN tags t ON tt.tag_id = t.id
     WHERE tt.deleted_at IS NULL AND t.deleted_at IS NULL`
  );

  const trickTagMap = buildTrickTagMap(trickTagRows);

  // Selection hook — sentinel-null + lock-in seeding. See `useHydratedSelection`
  // and `.claude/rules/new-feature.md` for the rationale (issue #216).
  const tagsSel = useHydratedSelection<TagId>({
    editingId: editingTrickId,
    isLoading: trickTagsLoading,
    seed: () =>
      (trickTagMap.get(editingTrickId ?? ("" as TrickId)) ?? []).map(
        (tag) => tag.id
      ),
  });

  // True while an Edit session is open and the trick row or trick_tags join
  // is still hydrating. Gates Save (so a keyboard submit can't write empty
  // diffs against a stale [] baseline) and swaps the picker for a skeleton.
  // Add path is never gated because handleAddTrick seeds via seedEmpty().
  const relationsLoading =
    editingTrickId !== null && (tagsSel.isHydrating || editingTrickLoading);

  // ---------------------------------------------------------------------------
  // Trick-items join query (build a Map<trickId, LinkedItem[]>)
  // ---------------------------------------------------------------------------
  const { data: trickItemRows, error: trickItemError } = useQuery<TrickItemRow>(
    `SELECT itr.trick_id, i.id AS item_id, i.name AS item_name
     FROM item_tricks itr
     JOIN items i ON itr.item_id = i.id
     WHERE itr.deleted_at IS NULL AND i.deleted_at IS NULL`
  );

  useEffect(() => {
    const error = trickTagError ?? trickItemError;
    if (error) {
      console.error("Failed to load trick relations:", error);
      toast.error(t("loadError"));
    }
  }, [trickTagError, trickItemError, t]);

  // ---------------------------------------------------------------------------
  // Editing trick load failure — close the sheet rather than render "add new"
  // (mirrors collect-view's editingItemError handler).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (editingTrickId && editingTrickError) {
      console.error("Failed to load trick for editing:", editingTrickError);
      // Do NOT pass error.message as description — PowerSync/SQLite messages
      // can carry row context or query fragments. Full error already in
      // console.error above for developer diagnostics.
      toast.error(t("loadError"), { id: LOAD_EDIT_TRICK_ERROR_TOAST_ID });
      setSheetOpen(false);
      setEditingTrickId(null);
      tagsSel.reset();
    }
  }, [editingTrickId, editingTrickError, t, tagsSel.reset]);

  const trickItemMap = buildTrickItemMap(trickItemRows);

  const tricksWithTags: TrickWithTags[] = tricks.map((trick) => ({
    ...trick,
    tags: trickTagMap.get(trick.id) ?? [],
  }));

  // Resolve names for the delete dialog and editing sheet
  const deletingTrickName =
    deletingTrickId === null
      ? null
      : (tricks.find((trick) => trick.id === deletingTrickId)?.name ?? null);

  // Selection diff vs the seeded baseline (or non-empty for Add). The hook's
  // isDirty handles the seeded edit case and returns false during hydration;
  // the Add-mode branch (no editingTrickId) compares against the [] baseline
  // that seedEmpty() laid down.
  const tagsDirty = editingTrickId
    ? tagsSel.isDirty
    : tagsSel.selected.length > 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleAddTrick(): void {
    setEditingTrickId(null);
    tagsSel.seedEmpty();
    setSheetOpen(true);
  }

  function handleEditTrick(id: TrickId): void {
    // Reset before switching the id so the next render skeletons rather than
    // briefly displaying the previous row's selection. The hook's auto-reseed
    // would otherwise leave stale `selected` visible for one render frame
    // when switching between Edit-A and Edit-B without closing the sheet.
    tagsSel.reset();
    setEditingTrickId(id);
    setSheetOpen(true);
  }

  function handleSheetOpenChange(open: boolean): void {
    setSheetOpen(open);
    if (!open) {
      setEditingTrickId(null);
      tagsSel.reset();
    }
  }

  async function handleSubmit(data: TrickFormValues): Promise<void> {
    try {
      if (editingTrickId) {
        // Defense-in-depth against keyboard submit before hook seeding has
        // hydrated. Save is also disabled via relationsLoading.
        if (relationsLoading) {
          console.warn(
            "[RepertoireView] Submit blocked: relations not yet hydrated"
          );
          return;
        }

        const originalSet = new Set(tagsSel.original);
        const currentSet = new Set(tagsSel.selected);

        const addTagIds = tagsSel.selected.filter((id) => !originalSet.has(id));
        const removeTagIds = tagsSel.original.filter(
          (id) => !currentSet.has(id)
        );

        await updateTrick(editingTrickId, data, addTagIds, removeTagIds);
        toast.success(t("trickUpdated"));
      } else {
        // Add path: handleAddTrick seeded selection to [] via seedEmpty().
        await createTrick(data, tagsSel.selected);
        toast.success(t("trickCreated"));
      }

      setSheetOpen(false);
      setEditingTrickId(null);
      tagsSel.reset();
    } catch (error) {
      console.error("Failed to save trick:", error);
      const errorKey = getMutationErrorKey(error);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        toast.error(t("saveFailed"));
      }
    }
  }

  function handleDeleteTrick(id: TrickId): void {
    setDeletingTrickId(id);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingTrickId) {
      return;
    }

    try {
      await deleteTrick(deletingTrickId);
      toast.success(t("trickDeleted"));
    } catch (error) {
      console.error("Failed to delete trick:", error);
      const errorKey = getMutationErrorKey(error);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        toast.error(t("deleteFailed"));
      }
    } finally {
      setDeleteDialogOpen(false);
      setDeletingTrickId(null);
    }
  }

  function handleDeleteDialogOpenChange(open: boolean): void {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeletingTrickId(null);
    }
  }

  function handleCreateTag(name: string): Promise<TagId> {
    return createTag(name);
  }

  // ---------------------------------------------------------------------------
  // Determine which content to render
  // ---------------------------------------------------------------------------
  const hasActiveFilters = Boolean(
    debouncedSearch || statusFilter || categoryFilter
  );

  function renderContent(): React.ReactElement {
    if (tricksWithTags.length > 0) {
      return (
        <TrickList
          itemMap={trickItemMap}
          onDelete={handleDeleteTrick}
          onEdit={handleEditTrick}
          tricks={tricksWithTags}
        />
      );
    }

    if (hasActiveFilters) {
      return (
        <p
          aria-live="polite"
          className="py-12 text-center text-muted-foreground"
          role="status"
        >
          {t("noResults")}
        </p>
      );
    }

    return <TrickEmptyState onAddTrick={handleAddTrick} />;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("trickCount", { count: tricksWithTags.length })}
          </p>
        </div>
        <Button onClick={handleAddTrick}>
          <PlusIcon />
          {t("addTrick")}
        </Button>
      </div>

      {/* Filters */}
      <TrickFilters
        categories={categories}
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
        onSearchChange={setSearch}
        onSortChange={(value) => {
          if (isFilterSortValue(value)) {
            setSort(value);
          }
        }}
        onStatusChange={setStatusFilter}
        search={search}
        sort={sort}
        status={statusFilter}
      />

      {/* List or Empty State */}
      {renderContent()}

      {/* Form Sheet */}
      <TrickFormSheet
        availableTags={tags}
        categories={categories}
        effectTypes={effectTypes}
        onCreateTag={handleCreateTag}
        onOpenChange={handleSheetOpenChange}
        onSubmit={handleSubmit}
        onToggleTag={tagsSel.toggle}
        open={sheetOpen}
        relationsLoading={relationsLoading}
        selectedTagIds={tagsSel.selected}
        tagsDirty={tagsDirty}
        trick={editingTrick}
      />

      {/* Delete Dialog */}
      <TrickDeleteDialog
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={deleteDialogOpen}
        trickName={deletingTrickName}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFilterSortValue(value: string): value is FilterSortValue {
  return value in SORT_MAP;
}

/**
 * Builds a Map from trick ID to its linked items, given the raw join rows.
 */
function buildTrickItemMap(
  rows: TrickItemRow[]
): Map<TrickId, { id: ItemId; name: string }[]> {
  const map = new Map<TrickId, { id: ItemId; name: string }[]>();

  for (const row of rows) {
    const item = { id: row.item_id, name: row.item_name };

    const existing = map.get(row.trick_id);
    if (existing) {
      existing.push(item);
    } else {
      map.set(row.trick_id, [item]);
    }
  }

  return map;
}

/**
 * Builds a Map from trick ID to its parsed tags, given the raw join rows.
 * Runs on every render but the data set is small (local SQLite) and the
 * React Compiler handles memoization automatically.
 */
function buildTrickTagMap(rows: TrickTagRow[]): Map<string, ParsedTag[]> {
  const map = new Map<string, ParsedTag[]>();

  for (const row of rows) {
    const tag: ParsedTag = {
      id: row.tag_id as TagId,
      name: row.tag_name,
      color: row.color,
    };

    const existing = map.get(row.trick_id);
    if (existing) {
      map.set(row.trick_id, [...existing, tag]);
    } else {
      map.set(row.trick_id, [tag]);
    }
  }

  return map;
}
