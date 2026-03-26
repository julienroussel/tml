"use client";

import { useQuery } from "@powersync/react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TagId, TrickId } from "@/db/types";
import { useTagMutations } from "../hooks/use-tag-mutations";
import { useTags } from "../hooks/use-tags";
import { useTrick } from "../hooks/use-trick";
import { useTrickCategories } from "../hooks/use-trick-categories";
import { useTrickEffectTypes } from "../hooks/use-trick-effect-types";
import { useTrickMutations } from "../hooks/use-trick-mutations";
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

/** Debounce delay for the search input (milliseconds). */
const SEARCH_DEBOUNCE_MS = 300;

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
  // Tag selection (local state for the form, not persisted until save)
  // ---------------------------------------------------------------------------
  const [selectedTagIds, setSelectedTagIds] = useState<TagId[]>([]);

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------
  const { tricks } = useTricks({
    search: debouncedSearch,
    status: statusFilter,
    category: categoryFilter,
    sort: SORT_MAP[sort],
  });

  const { trick: editingTrick } = useTrick(editingTrickId);
  const { tags } = useTags();
  const { createTrick, updateTrick, deleteTrick } = useTrickMutations();
  const { createTag } = useTagMutations();
  const categories = useTrickCategories();
  const effectTypes = useTrickEffectTypes();

  // ---------------------------------------------------------------------------
  // Trick-tags join query (build a Map<trickId, ParsedTag[]>)
  // ---------------------------------------------------------------------------
  const { data: trickTagRows } = useQuery<TrickTagRow>(
    `SELECT tt.trick_id, t.id AS tag_id, t.name AS tag_name, t.color
     FROM trick_tags tt
     JOIN tags t ON tt.tag_id = t.id
     WHERE tt.deleted_at IS NULL AND t.deleted_at IS NULL`
  );

  const trickTagMap = buildTrickTagMap(trickTagRows);

  const tricksWithTags: TrickWithTags[] = tricks.map((trick) => ({
    ...trick,
    tags: trickTagMap.get(trick.id) ?? [],
  }));

  // Resolve names for the delete dialog and editing sheet
  const deletingTrickName =
    deletingTrickId === null
      ? null
      : (tricks.find((trick) => trick.id === deletingTrickId)?.name ?? null);

  // Original tag IDs for the trick being edited (used to compute diff on save)
  const editingTrickOriginalTagIds = editingTrickId
    ? (trickTagMap.get(editingTrickId) ?? []).map((tag) => tag.id)
    : ([] as TagId[]);

  // Whether the tag selection has diverged from the original (or is non-empty for new tricks)
  const tagsDirty = editingTrickId
    ? selectedTagIds.length !== editingTrickOriginalTagIds.length ||
      selectedTagIds.some((id) => !editingTrickOriginalTagIds.includes(id))
    : selectedTagIds.length > 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleAddTrick(): void {
    setEditingTrickId(null);
    setSelectedTagIds([]);
    setSheetOpen(true);
  }

  function handleEditTrick(id: TrickId): void {
    setEditingTrickId(id);

    // Preload the current tag selection for this trick
    const currentTags = trickTagMap.get(id) ?? [];
    setSelectedTagIds(currentTags.map((tag) => tag.id));

    setSheetOpen(true);
  }

  function handleSheetOpenChange(open: boolean): void {
    setSheetOpen(open);
    if (!open) {
      setEditingTrickId(null);
      setSelectedTagIds([]);
    }
  }

  async function handleSubmit(data: TrickFormValues): Promise<void> {
    try {
      if (editingTrickId) {
        const originalSet = new Set(editingTrickOriginalTagIds);
        const currentSet = new Set(selectedTagIds);

        const addTagIds = selectedTagIds.filter((id) => !originalSet.has(id));
        const removeTagIds = editingTrickOriginalTagIds.filter(
          (id) => !currentSet.has(id)
        );

        await updateTrick(editingTrickId, data, addTagIds, removeTagIds);
        toast.success(t("trickUpdated"));
      } else {
        await createTrick(data, selectedTagIds);
        toast.success(t("trickCreated"));
      }

      setSheetOpen(false);
      setEditingTrickId(null);
      setSelectedTagIds([]);
    } catch {
      toast.error(t("saveFailed"));
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
    } catch {
      toast.error(t("deleteFailed"));
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

  function handleToggleTag(tagId: TagId): void {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
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
        onToggleTag={handleToggleTag}
        open={sheetOpen}
        selectedTagIds={selectedTagIds}
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
