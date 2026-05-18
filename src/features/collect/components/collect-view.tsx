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
import { useHydratedSelection } from "@/hooks/use-hydrated-selection";
import { useItem } from "../hooks/use-item";
import { useItemBrands } from "../hooks/use-item-brands";
import { useItemLocations } from "../hooks/use-item-locations";
import {
  getMutationErrorKey,
  useItemMutations,
} from "../hooks/use-item-mutations";
import { useItems } from "../hooks/use-items";
import type { ItemFormValues } from "../schema";
import type { ItemWithRelations, LinkedTrick, ParsedItem } from "../types";
import {
  buildItemTagMap,
  buildItemTrickMap,
  type ItemTagRow,
  type ItemTrickRow,
} from "./collect-helpers";
import { ItemDeleteDialog } from "./item-delete-dialog";
import { ItemEmptyState } from "./item-empty-state";
import { ItemFilters } from "./item-filters";
import { ItemFormSheet, type ItemFormSheetMode } from "./item-form-sheet";
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
/** Stable toast id for the settled-missing case (item was deleted on another device). */
const ITEM_NO_LONGER_EXISTS_TOAST_ID = "collect-item-no-longer-exists";
/**
 * Stable toast id for critical relation-query failures (item_tags, item_tricks,
 * or the available-tricks picker source). One id covers all three because they
 * share the same surfaced message and we never want to stack them. Issue #218.
 */
const LOAD_RELATIONS_ERROR_TOAST_ID = "collect-load-relations-error";

/** Debounce delay for the search input (milliseconds). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * SQL strings exported as module-level constants so tests can match by
 * reference equality rather than fragile substring inspection. The exact
 * whitespace/structure is preserved — PowerSync parses these verbatim.
 */
export const ITEM_TAGS_QUERY = `SELECT it.item_id, t.id AS tag_id, t.name AS tag_name, t.color
     FROM item_tags it
     JOIN tags t ON it.tag_id = t.id
     WHERE it.deleted_at IS NULL AND t.deleted_at IS NULL`;

export const ITEM_TRICKS_QUERY = `SELECT itr.item_id, tr.id AS trick_id, tr.name AS trick_name
     FROM item_tricks itr
     JOIN tricks tr ON itr.trick_id = tr.id
     WHERE itr.deleted_at IS NULL AND tr.deleted_at IS NULL`;

export const AVAILABLE_TRICKS_QUERY =
  "SELECT id, name FROM tricks WHERE deleted_at IS NULL ORDER BY name ASC";

/**
 * Derive the form sheet's discriminated mode from the edit-target query state.
 * Identity-based: "edit" requires the loaded row's id to match the requested
 * `editingItemId` — otherwise the row is stale (an Edit→Edit target switch) or
 * absent (still in-flight, or settled-missing), so the mode is "loading".
 *
 * Keying on row identity rather than the `isLoading` flag is deliberate:
 * `useItem` folds PowerSync's `isFetching`, which flickers true on unrelated
 * `items`-table re-emits. Gating on it would flip a steady edit session to
 * "loading", unmounting `ItemForm` and dropping the user's typed text (#217).
 */
function deriveSheetMode(
  editingItemId: ItemId | null,
  editingItem: ParsedItem | null
): ItemFormSheetMode {
  if (editingItemId === null) {
    return { mode: "create" };
  }
  if (editingItem !== null && editingItem.id === editingItemId) {
    return { mode: "edit", item: editingItem };
  }
  return { mode: "loading" };
}

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
  // Data hooks
  // ---------------------------------------------------------------------------
  const { items, error: itemsError } = useItems({
    search: debouncedSearch,
    type: typeFilter,
    condition: conditionFilter,
    sort,
  });

  const {
    item: editingItem,
    error: editingItemError,
    hasSettled: editingItemSettled,
  } = useItem(editingItemId);
  const { tags, error: tagError } = useTags();
  const { createItem, updateItem, deleteItem } = useItemMutations();
  const { createTag } = useTagMutations();
  const { brands: userBrands, error: brandsError } = useItemBrands();
  const { locations: userLocations, error: locationsError } =
    useItemLocations();

  // ---------------------------------------------------------------------------
  // Item-tags join query (build a Map<itemId, ParsedTag[]>)
  // ---------------------------------------------------------------------------
  const {
    data: itemTagRows,
    error: itemTagError,
    isLoading: itemTagsLoading,
  } = useQuery<ItemTagRow>(ITEM_TAGS_QUERY);

  const itemTagMap = buildItemTagMap(itemTagRows);

  // ---------------------------------------------------------------------------
  // Item-tricks join query (build a Map<itemId, LinkedTrick[]>)
  // ---------------------------------------------------------------------------
  const {
    data: itemTrickRows,
    error: itemTrickError,
    isLoading: itemTricksLoading,
  } = useQuery<ItemTrickRow>(ITEM_TRICKS_QUERY);

  const itemTrickMap = buildItemTrickMap(itemTrickRows);

  // Selection hooks — sentinel-null + lock-in seeding. See `useHydratedSelection`
  // and the `.claude/rules/new-feature.md` pointer for the rationale (issue #216).
  const tagsSel = useHydratedSelection<TagId>({
    editingId: editingItemId,
    isLoading: itemTagsLoading,
    seed: () =>
      editingItemId === null
        ? []
        : (itemTagMap.get(editingItemId) ?? []).map((tag) => tag.id),
  });
  const tricksSel = useHydratedSelection<TrickId>({
    editingId: editingItemId,
    isLoading: itemTricksLoading,
    seed: () =>
      editingItemId === null
        ? []
        : (itemTrickMap.get(editingItemId) ?? []).map((trick) => trick.id),
  });

  // Identity-gated mode + relations-loading union. See deriveSheetMode + use-item.ts for the isFetching-fold rationale.
  const sheetMode = deriveSheetMode(editingItemId, editingItem);

  // `editingItemError` is OR'd in as belt-and-suspenders: when the row query
  // errors while a stale matching-id row is still present, deriveSheetMode
  // briefly returns "edit" — so without this term Save would flicker enabled
  // for the one render before the close-on-error effect batches in.
  const relationsLoading =
    editingItemId !== null &&
    (sheetMode.mode === "loading" ||
      editingItemError != null ||
      tagsSel.isHydrating ||
      tricksSel.isHydrating);

  // ---------------------------------------------------------------------------
  // Available tricks for the trick picker (only when form sheet is open)
  // ---------------------------------------------------------------------------
  // Eager-load tricks for the picker. Local SQLite query cost is negligible,
  // and gating on sheetOpen caused re-registration churn and an empty-picker
  // flash while the async query hydrated after the sheet opened.
  const { data: availableTrickRows, error: availableTricksError } =
    useQuery<AvailableTrickRow>(AVAILABLE_TRICKS_QUERY);

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
  // Edit target unavailable — close the sheet rather than render "add new".
  // Two cases: the row query errored, or it settled with no row (the item was
  // deleted out from under us between list render and the useItem query). Both
  // route through the same close + toast (issue #217). Gates on `hasSettled`
  // (a per-id sticky settle latch exposed by useItem) instead of the folded
  // `!isLoading`: the fold flickers true on unrelated `items`-table re-emits
  // during sync churn, which would unreliably delay the close+toast
  // (issue #287). hasSettled latches on the first quiet render for the
  // current id and stays sticky through subsequent isFetching flickers.
  // ---------------------------------------------------------------------------
  // Derived boolean for the effect dep — depending on `editingItem` directly
  // would re-fire the effect on every PowerSync re-emit of the row (fresh
  // object identity), which dilutes the per-id sticky settle work in
  // `useItem`. Only the nullness is load-bearing for the close+toast gate.
  const editingItemMissing = editingItem === null;
  useEffect(() => {
    if (editingItemId === null) {
      return;
    }
    const settledMissing = editingItemMissing && editingItemSettled;
    if (!(editingItemError || settledMissing)) {
      return;
    }
    // Do NOT pass editingItemError.message as description — PowerSync/SQLite
    // error messages can contain row context, query fragments, or user-supplied
    // values. The full error is already in the log below for developer
    // diagnostics. Log level branches on cause: load error → console.error
    // (developer-actionable); settled-missing → console.warn (normal
    // offline-first outcome). Toast id branches likewise so a retry sequence
    // (loadError then settled-missing) shows both states rather than dedup.
    const logUnavailable = editingItemError ? console.error : console.warn;
    logUnavailable(
      "[CollectView] Edit target unavailable:",
      editingItemError ?? "row not found"
    );
    toast.error(editingItemError ? t("loadError") : t("itemNoLongerExists"), {
      id: editingItemError
        ? LOAD_EDIT_ITEM_ERROR_TOAST_ID
        : ITEM_NO_LONGER_EXISTS_TOAST_ID,
    });
    setSheetOpen(false);
    setEditingItemId(null);
    tagsSel.reset();
    tricksSel.reset();
  }, [
    editingItemId,
    editingItemMissing,
    editingItemError,
    editingItemSettled,
    t,
    tagsSel.reset,
    tricksSel.reset,
  ]);

  // ---------------------------------------------------------------------------
  // Items list error — toast on the list page since items are the page's data.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (itemsError) {
      console.error("[CollectView] Items query error:", itemsError);
      toast.error(t("loadError"), { id: LOAD_ITEMS_ERROR_TOAST_ID });
    }
  }, [itemsError, t]);

  // ---------------------------------------------------------------------------
  // Critical relation-query failures (issue #218 + #263). The empty/stale data
  // they produce feeds useHydratedSelection's seed (and the picker source for
  // tagError/availableTricksError), which doesn't observe `error` — a save
  // against the wrong baseline can silently NOT remove an existing-but-invisible
  // relation, or hit a UNIQUE/PK violation when the user re-toggles it. Toast
  // always so the user is informed even before clicking Edit/Add. Stable id so
  // re-renders dedupe.
  //
  // Picker-source vs junction distinction:
  //   - tagError / availableTricksError → no available items to PICK from;
  //     gates both Add and Edit (the picker is used in both flows).
  //   - itemTagError / itemTrickError   → can't seed EXISTING relations on the
  //     item being edited; gates Edit only (Add seeds via seedEmpty()).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const error =
      itemTagError ?? itemTrickError ?? availableTricksError ?? tagError;
    if (!error) {
      return;
    }
    console.error("[CollectView] Relation query error", {
      itemTagError,
      itemTrickError,
      availableTricksError,
      tagError,
    });
    toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
  }, [itemTagError, itemTrickError, availableTricksError, tagError, t]);

  // ---------------------------------------------------------------------------
  // Supplementary queries — datalist autocomplete only. Log so we can debug
  // from session reports; do NOT toast (would be alarming for a non-critical
  // degradation that doesn't affect save correctness).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (brandsError) {
      console.error("[CollectView] Brands query error:", brandsError);
    }
    if (locationsError) {
      console.error("[CollectView] Locations query error:", locationsError);
    }
  }, [brandsError, locationsError]);

  // ---------------------------------------------------------------------------
  // If a critical relation error fires while the sheet is open, close it
  // rather than let the user save against potentially corrupted seed data.
  // Mirrors the editingItemError handler above. Mode-scoped to match the
  // handler-entry guards (issue #218 + #263 matrix):
  //   - Edit (editingItemId !== null): any of item_tags / item_tricks /
  //     available_tricks / tags errors → close.
  //   - Add (editingItemId === null): only the picker sources matter —
  //     available_tricks (trick picker) and tags (tag picker). The
  //     item-scoped joins (item_tags / item_tricks) don't feed the Add path.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    const inEditMode = editingItemId !== null;
    const shouldClose = Boolean(
      inEditMode
        ? itemTagError || itemTrickError || availableTricksError || tagError
        : availableTricksError || tagError
    );
    if (shouldClose) {
      setSheetOpen(false);
      setEditingItemId(null);
      tagsSel.reset();
      tricksSel.reset();
    }
  }, [
    sheetOpen,
    editingItemId,
    itemTagError,
    itemTrickError,
    availableTricksError,
    tagError,
    tagsSel.reset,
    tricksSel.reset,
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

  // Selection diff vs the seeded baseline (or non-empty for Add). The hook's
  // isDirty handles the seeded edit case and returns false during hydration;
  // the Add-mode branch (no editingItemId) compares against the [] baseline
  // that seedEmpty() laid down.
  const tagsDirty = editingItemId
    ? tagsSel.isDirty
    : tagsSel.selected.length > 0;
  const tricksDirty = editingItemId
    ? tricksSel.isDirty
    : tricksSel.selected.length > 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleAddItem(): void {
    // Picker sources (availableTricks + tags) feed both Add and Edit; without
    // them the user would create an item with an empty/misleading trick list
    // or no tag picker (issue #218 + #263). The item-scoped junction errors
    // (itemTagError / itemTrickError) are edit-only and not checked here.
    if (availableTricksError || tagError) {
      toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
      return;
    }
    setEditingItemId(null);
    tagsSel.seedEmpty();
    tricksSel.seedEmpty();
    setSheetOpen(true);
  }

  function handleEditItem(id: ItemId): void {
    // Block opening the sheet if relation queries are broken — without
    // current relations the seed lock-in would be empty, and the user
    // can't see what they have or remove what they've toggled (issue #218).
    // tagError additionally blocks because the picker has no tags to render
    // even if the existing-tag seed is intact (issue #263).
    if (itemTagError || itemTrickError || availableTricksError || tagError) {
      toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
      return;
    }
    // Reset before switching the id so the next render skeletons rather than
    // briefly displaying the previous row's selection. The hook's auto-reseed
    // would otherwise leave stale `selected` visible for one render frame
    // when switching between Edit-A and Edit-B without closing the sheet.
    tagsSel.reset();
    tricksSel.reset();
    setEditingItemId(id);
    setSheetOpen(true);
  }

  function handleSheetOpenChange(open: boolean): void {
    setSheetOpen(open);
    if (!open) {
      setEditingItemId(null);
      tagsSel.reset();
      tricksSel.reset();
    }
  }

  async function handleSubmit(data: ItemFormValues): Promise<void> {
    try {
      if (editingItemId) {
        // Defense-in-depth against keyboard submit before hook seeding has
        // hydrated. Save is also disabled via relationsLoading, but a stray
        // Enter press could still fire submit.
        if (relationsLoading) {
          console.warn(
            "[CollectView] Submit blocked: relations not yet hydrated"
          );
          toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
          return;
        }

        const originalTagSet = new Set(tagsSel.original);
        const currentTagSet = new Set(tagsSel.selected);
        const addTagIds = tagsSel.selected.filter(
          (id) => !originalTagSet.has(id)
        );
        const removeTagIds = tagsSel.original.filter(
          (id) => !currentTagSet.has(id)
        );

        const originalTrickSet = new Set(tricksSel.original);
        const currentTrickSet = new Set(tricksSel.selected);
        const addTrickIds = tricksSel.selected.filter(
          (id) => !originalTrickSet.has(id)
        );
        const removeTrickIds = tricksSel.original.filter(
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
        // Add path: handleAddItem seeded both selections to [] via seedEmpty().
        await createItem(data, tagsSel.selected, tricksSel.selected);
        toast.success(t("itemCreated"));
      }

      setSheetOpen(false);
      setEditingItemId(null);
      tagsSel.reset();
      tricksSel.reset();
    } catch (error) {
      console.error("[CollectView] Item save failed:", error);
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
      console.error("[CollectView] Item delete failed:", error);
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

  async function handleCreateTag(name: string): Promise<TagId> {
    try {
      return await createTag(name);
    } catch (error) {
      // TagPicker owns the user-facing toast; we only log and rethrow so the
      // child component can reset its UI state. Avoid duplicate toasts here.
      console.error("[CollectView] Tag create failed:", error);
      throw error;
    }
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
        mode={sheetMode}
        onCreateTag={handleCreateTag}
        onOpenChange={handleSheetOpenChange}
        onSubmit={handleSubmit}
        onToggleTag={tagsSel.toggle}
        onToggleTrick={tricksSel.toggle}
        open={sheetOpen}
        relationsLoading={relationsLoading}
        selectedTagIds={tagsSel.selected}
        selectedTrickIds={tricksSel.selected}
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
