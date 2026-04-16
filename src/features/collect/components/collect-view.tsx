"use client";

import { useQuery } from "@powersync/react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { asTrickId, type ItemId, type TagId, type TrickId } from "@/db/types";
import {
  type FilterSortValue,
  type ItemCondition,
  type ItemType,
  MAX_TRICKS_PER_ITEM,
} from "@/features/collect/constants";
import { useTagMutations } from "@/features/repertoire/hooks/use-tag-mutations";
import { useTags } from "@/features/repertoire/hooks/use-tags";
import { useItem } from "../hooks/use-item";
import { useItemBrands } from "../hooks/use-item-brands";
import { useItemLocations } from "../hooks/use-item-locations";
import {
  getMutationErrorKey,
  useItemMutations,
} from "../hooks/use-item-mutations";
import { useItems } from "../hooks/use-items";
import type { ItemFormValues } from "../schema";
import type { ItemWithRelations, LinkedTrick } from "../types";
import {
  buildItemTagMap,
  buildItemTrickMap,
  type ItemTagRow,
  type ItemTrickRow,
} from "./collect-helpers";
import { ItemDeleteDialog } from "./item-delete-dialog";
import { ItemEmptyState } from "./item-empty-state";
import { ItemFilters } from "./item-filters";
import { ItemFormSheet } from "./item-form-sheet";
import { ItemList } from "./item-list";

/** Row shape for available tricks. */
interface AvailableTrickRow {
  id: string;
  name: string;
}

/**
 * UUID v1-v5 regex. Validates raw PowerSync row ids at the trust boundary
 * before lifting them to branded IDs via `asTrickId` (type-only cast).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable toast id for the items list load error (replaces rather than stacks). */
const LOAD_ITEMS_ERROR_TOAST_ID = "collect-load-items-error";
/** Stable toast id for the editing-item load error (separate so it doesn't clobber the items toast). */
const LOAD_EDIT_ITEM_ERROR_TOAST_ID = "collect-load-edit-item-error";

/** Debounce delay for the search input (milliseconds). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Main orchestration component for the collection feature.
 *
 * Manages all state (filters, sheet, delete dialog, tag/trick selection)
 * and wires up data hooks with child components.
 */
export function CollectView(): React.ReactElement {
  const t = useTranslations("collect");

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);
  const [conditionFilter, setConditionFilter] = useState<ItemCondition | null>(
    null
  );
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
  const [editingItemId, setEditingItemId] = useState<ItemId | null>(null);

  // ---------------------------------------------------------------------------
  // Delete dialog state
  // ---------------------------------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<ItemId | null>(null);

  // ---------------------------------------------------------------------------
  // Tag selection (local state for the form, not persisted until save)
  // ---------------------------------------------------------------------------
  const [selectedTagIds, setSelectedTagIds] = useState<TagId[]>([]);

  // ---------------------------------------------------------------------------
  // Trick selection (local state for the form, not persisted until save)
  // ---------------------------------------------------------------------------
  const [selectedTrickIds, setSelectedTrickIds] = useState<TrickId[]>([]);

  // Snapshot of tag/trick IDs captured when edit form opens (stable diff baseline).
  // Known cold-start race — if PowerSync join hasn't hydrated at click time, this
  // starts empty. Tracked in a follow-up issue.
  const [originalTagIds, setOriginalTagIds] = useState<TagId[]>([]);
  const [originalTrickIds, setOriginalTrickIds] = useState<TrickId[]>([]);

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------
  const { items, error: itemsError } = useItems({
    search: debouncedSearch,
    type: typeFilter,
    condition: conditionFilter,
    sort,
  });

  const { item: editingItem, error: editingItemError } = useItem(editingItemId);
  const { tags } = useTags();
  const { createItem, updateItem, deleteItem } = useItemMutations();
  const { createTag } = useTagMutations();
  const { brands: userBrands, error: brandsError } = useItemBrands();
  const { locations: userLocations, error: locationsError } =
    useItemLocations();

  // ---------------------------------------------------------------------------
  // Item-tags join query (build a Map<itemId, ParsedTag[]>)
  // ---------------------------------------------------------------------------
  const { data: itemTagRows, error: itemTagError } = useQuery<ItemTagRow>(
    `SELECT it.item_id, t.id AS tag_id, t.name AS tag_name, t.color
     FROM item_tags it
     JOIN tags t ON it.tag_id = t.id
     WHERE it.deleted_at IS NULL AND t.deleted_at IS NULL`
  );

  const itemTagMap = buildItemTagMap(itemTagRows);

  // ---------------------------------------------------------------------------
  // Item-tricks join query (build a Map<itemId, LinkedTrick[]>)
  // ---------------------------------------------------------------------------
  const { data: itemTrickRows, error: itemTrickError } = useQuery<ItemTrickRow>(
    `SELECT itr.item_id, tr.id AS trick_id, tr.name AS trick_name
     FROM item_tricks itr
     JOIN tricks tr ON itr.trick_id = tr.id
     WHERE itr.deleted_at IS NULL AND tr.deleted_at IS NULL`
  );

  const itemTrickMap = buildItemTrickMap(itemTrickRows);

  // ---------------------------------------------------------------------------
  // Available tricks for the trick picker (only when form sheet is open)
  // ---------------------------------------------------------------------------
  // Eager-load tricks for the picker. Local SQLite query cost is negligible,
  // and gating on sheetOpen caused re-registration churn and an empty-picker
  // flash while the async query hydrated after the sheet opened.
  const { data: availableTrickRows, error: availableTricksError } =
    useQuery<AvailableTrickRow>(
      "SELECT id, name FROM tricks WHERE deleted_at IS NULL ORDER BY name ASC"
    );

  const availableTricks: LinkedTrick[] = availableTrickRows.flatMap((row) => {
    if (typeof row.id !== "string" || !UUID_RE.test(row.id)) {
      console.warn(
        "[CollectView] Invalid trick id in availableTricks, skipping",
        {
          id: typeof row.id === "string" ? `${row.id.slice(0, 8)}...` : null,
        }
      );
      return [];
    }
    return [{ id: asTrickId(row.id), name: row.name }];
  });

  // ---------------------------------------------------------------------------
  // Editing item load failure — close the sheet rather than render "add new"
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (editingItemId && editingItemError) {
      console.error("Failed to load item for editing:", editingItemError);
      // Do NOT pass editingItemError.message as description — PowerSync/SQLite
      // error messages can contain row context, query fragments, or user-supplied
      // values. The full error is already in the console.error above for
      // developer diagnostics. Matches the items-error toast shape (line ~224).
      toast.error(t("loadError"), {
        id: LOAD_EDIT_ITEM_ERROR_TOAST_ID,
      });
      setSheetOpen(false);
      setEditingItemId(null);
      setSelectedTagIds([]);
      setSelectedTrickIds([]);
      setOriginalTagIds([]);
      setOriginalTrickIds([]);
    }
  }, [editingItemId, editingItemError, t]);

  // ---------------------------------------------------------------------------
  // Surface critical query errors as a single, replaceable toast.
  // Supplementary queries (brands, locations, trick-join) only log.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (brandsError) {
      console.error("Brands query error:", brandsError);
    }
    if (locationsError) {
      console.error("Locations query error:", locationsError);
    }
    if (itemTagError) {
      console.error("Item-tags query error:", itemTagError);
    }
    if (itemTrickError) {
      console.error("Item-tricks query error:", itemTrickError);
    }
    if (availableTricksError) {
      console.error("Available tricks query error:", availableTricksError);
    }
    if (itemsError) {
      console.error("Items query error:", itemsError);
      toast.error(t("loadError"), { id: LOAD_ITEMS_ERROR_TOAST_ID });
    }
  }, [
    itemsError,
    itemTagError,
    itemTrickError,
    availableTricksError,
    brandsError,
    locationsError,
    t,
  ]);

  // ---------------------------------------------------------------------------
  // Build items with relations
  // ---------------------------------------------------------------------------
  const itemsWithRelations: ItemWithRelations[] = items.map((item) => ({
    ...item,
    tags: itemTagMap.get(item.id) ?? [],
    tricks: itemTrickMap.get(item.id) ?? [],
  }));

  // Resolve names for the delete dialog
  const deletingItemName =
    deletingItemId === null
      ? null
      : (items.find((item) => item.id === deletingItemId)?.name ?? null);

  // Whether the tag selection has diverged from the snapshot (or is non-empty for new items)
  const tagsDirty = editingItemId
    ? selectedTagIds.length !== originalTagIds.length ||
      selectedTagIds.some((id) => !originalTagIds.includes(id))
    : selectedTagIds.length > 0;

  // Whether the trick selection has diverged from the snapshot (or is non-empty for new items)
  const tricksDirty = editingItemId
    ? selectedTrickIds.length !== originalTrickIds.length ||
      selectedTrickIds.some((id) => !originalTrickIds.includes(id))
    : selectedTrickIds.length > 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleAddItem(): void {
    setEditingItemId(null);
    setSelectedTagIds([]);
    setSelectedTrickIds([]);
    setOriginalTagIds([]);
    setOriginalTrickIds([]);
    setSheetOpen(true);
  }

  function handleEditItem(id: ItemId): void {
    setEditingItemId(id);

    // Snapshot the current tag/trick IDs as the diff baseline for this edit session.
    // Cold-start race: if the PowerSync join hasn't hydrated yet, both snapshot and
    // selection start as []. Tracked as a follow-up issue.
    const currentTags = itemTagMap.get(id) ?? [];
    const currentTagIds = currentTags.map((tag) => tag.id);
    setSelectedTagIds(currentTagIds);
    setOriginalTagIds(currentTagIds);

    const currentTricks = itemTrickMap.get(id) ?? [];
    const currentTrickIds = currentTricks.map((trick) => trick.id);
    setSelectedTrickIds(currentTrickIds);
    setOriginalTrickIds(currentTrickIds);

    setSheetOpen(true);
  }

  function handleSheetOpenChange(open: boolean): void {
    setSheetOpen(open);
    if (!open) {
      setEditingItemId(null);
      setSelectedTagIds([]);
      setSelectedTrickIds([]);
      setOriginalTagIds([]);
      setOriginalTrickIds([]);
    }
  }

  async function handleSubmit(data: ItemFormValues): Promise<void> {
    try {
      if (editingItemId) {
        const originalTagSet = new Set(originalTagIds);
        const currentTagSet = new Set(selectedTagIds);
        const addTagIds = selectedTagIds.filter(
          (id) => !originalTagSet.has(id)
        );
        const removeTagIds = originalTagIds.filter(
          (id) => !currentTagSet.has(id)
        );

        const originalTrickSet = new Set(originalTrickIds);
        const currentTrickSet = new Set(selectedTrickIds);
        const addTrickIds = selectedTrickIds.filter(
          (id) => !originalTrickSet.has(id)
        );
        const removeTrickIds = originalTrickIds.filter(
          (id) => !currentTrickSet.has(id)
        );

        await updateItem(
          editingItemId,
          data,
          addTagIds,
          removeTagIds,
          addTrickIds,
          removeTrickIds
        );
        toast.success(t("itemUpdated"));
      } else {
        await createItem(data, selectedTagIds, selectedTrickIds);
        toast.success(t("itemCreated"));
      }

      setSheetOpen(false);
      setEditingItemId(null);
      setSelectedTagIds([]);
      setSelectedTrickIds([]);
      setOriginalTagIds([]);
      setOriginalTrickIds([]);
    } catch (error) {
      console.error("Item save failed:", error);
      const errorKey = getMutationErrorKey(error);
      if (errorKey === "validation.tooManyTricks") {
        toast.error(t(errorKey, { count: MAX_TRICKS_PER_ITEM }));
      } else if (errorKey) {
        toast.error(t(errorKey));
      } else {
        toast.error(t("saveFailed"));
      }
      // Re-throw so the child ItemFormSheet's handleFormSubmit catches it and
      // skips its post-await setFormDirty(false) — keeps RHF isDirty and the
      // local formDirty mirror in sync when save fails.
      throw error;
    }
  }

  function handleDeleteItem(id: ItemId): void {
    setDeletingItemId(id);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingItemId) {
      return;
    }

    try {
      await deleteItem(deletingItemId);
      toast.success(t("itemDeleted"));
    } catch (error) {
      console.error("Item delete failed:", error);
      const errorKey = getMutationErrorKey(error);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        toast.error(t("deleteFailed"));
      }
    } finally {
      setDeleteDialogOpen(false);
      setDeletingItemId(null);
    }
  }

  function handleDeleteDialogOpenChange(open: boolean): void {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeletingItemId(null);
    }
  }

  function handleToggleTag(tagId: TagId): void {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleCreateTag(name: string): Promise<TagId> {
    try {
      return await createTag(name);
    } catch (error) {
      // TagPicker owns the user-facing toast; we only log and rethrow so the
      // child component can reset its UI state. Avoid duplicate toasts here.
      console.error("Tag create failed:", error);
      throw error;
    }
  }

  function handleToggleTrick(trickId: TrickId): void {
    setSelectedTrickIds((prev) =>
      prev.includes(trickId)
        ? prev.filter((id) => id !== trickId)
        : [...prev, trickId]
    );
  }

  // ---------------------------------------------------------------------------
  // Determine which content to render
  // ---------------------------------------------------------------------------
  const hasActiveFilters = Boolean(
    debouncedSearch || typeFilter || conditionFilter
  );

  function renderContent(): React.ReactElement {
    if (itemsWithRelations.length > 0) {
      return (
        <ItemList
          items={itemsWithRelations}
          onDelete={handleDeleteItem}
          onEdit={handleEditItem}
        />
      );
    }

    if (hasActiveFilters) {
      return (
        <p className="py-12 text-center text-muted-foreground" role="status">
          {t("noResults")}
        </p>
      );
    }

    return <ItemEmptyState onAddItem={handleAddItem} />;
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
            {t("itemCount", { count: itemsWithRelations.length })}
          </p>
        </div>
        <Button onClick={handleAddItem}>
          <PlusIcon />
          {t("addItem")}
        </Button>
      </div>

      {/* Filters */}
      <ItemFilters
        condition={conditionFilter}
        onConditionChange={setConditionFilter}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onTypeChange={setTypeFilter}
        search={search}
        sort={sort}
        type={typeFilter}
      />

      {/* Screen-reader-only summary that announces the filtered result count
          after the debounced search settles. The full list wrapper is NOT an
          aria-live region — announcing the entire list on every keystroke is
          noisy; the "no results" paragraph below has its own role="status". */}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {t("itemCount", { count: itemsWithRelations.length })}
      </div>

      {/* List or Empty State */}
      <div>{renderContent()}</div>

      {/* Form Sheet */}
      <ItemFormSheet
        availableTags={tags}
        availableTricks={availableTricks}
        item={editingItem}
        onCreateTag={handleCreateTag}
        onOpenChange={handleSheetOpenChange}
        onSubmit={handleSubmit}
        onToggleTag={handleToggleTag}
        onToggleTrick={handleToggleTrick}
        open={sheetOpen}
        selectedTagIds={selectedTagIds}
        selectedTrickIds={selectedTrickIds}
        tagsDirty={tagsDirty}
        tricksDirty={tricksDirty}
        userBrands={userBrands}
        userLocations={userLocations}
      />

      {/* Delete Dialog */}
      <ItemDeleteDialog
        itemName={deletingItemName}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={deleteDialogOpen}
      />
    </div>
  );
}
