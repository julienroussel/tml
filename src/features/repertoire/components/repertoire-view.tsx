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
import type { ParsedTag, ParsedTrick, TrickWithTags } from "../types";
import { TrickDeleteDialog } from "./trick-delete-dialog";
import { TrickEmptyState } from "./trick-empty-state";
import { TrickFilters } from "./trick-filters";
import { TrickFormSheet, type TrickFormSheetMode } from "./trick-form-sheet";
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
export interface TrickTagRow {
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

/**
 * SQL for the trick_tags + tags join. Exported so tests can match by reference
 * equality (substring matching is fragile — see finding #8). Whitespace is
 * preserved verbatim because PowerSync parses these strings.
 */
export const TRICK_TAGS_QUERY = `SELECT tt.trick_id, t.id AS tag_id, t.name AS tag_name, t.color
     FROM trick_tags tt
     JOIN tags t ON tt.tag_id = t.id
     WHERE tt.deleted_at IS NULL AND t.deleted_at IS NULL`;

/**
 * SQL for the item_tricks + items join. Exported alongside TRICK_TAGS_QUERY
 * for the same reference-equality reason. Whitespace preserved verbatim.
 */
export const TRICK_ITEMS_QUERY = `SELECT itr.trick_id, i.id AS item_id, i.name AS item_name
     FROM item_tricks itr
     JOIN items i ON itr.item_id = i.id
     WHERE itr.deleted_at IS NULL AND i.deleted_at IS NULL`;

/** Stable toast id for the editing-trick load error (separate so it doesn't clobber the relations toast). */
const LOAD_EDIT_TRICK_ERROR_TOAST_ID = "repertoire-load-edit-trick-error";
/** Stable toast id for the trick-no-longer-exists case (settled-missing row). */
const TRICK_NO_LONGER_EXISTS_TOAST_ID = "repertoire-trick-no-longer-exists";
/**
 * Stable toast id for trick_tags / trick_items query failures. One id covers
 * both — same surfaced message, never want to stack. Issue #218.
 */
const LOAD_RELATIONS_ERROR_TOAST_ID = "repertoire-load-relations-error";
/** Stable toast id for the primary tricks-list query error (mirrors collect-view's items-list pattern). */
const LOAD_TRICKS_ERROR_TOAST_ID = "repertoire-load-tricks-error";

/**
 * Derive the form sheet's discriminated mode from the edit-target query state.
 * Identity-based: "edit" requires the loaded row's id to match the requested
 * `editingTrickId` — otherwise the row is stale (an Edit→Edit target switch) or
 * absent (still in-flight, or settled-missing), so the mode is "loading".
 *
 * Keying on row identity rather than the `isLoading` flag is deliberate:
 * `useTrick` folds PowerSync's `isFetching`, which flickers true on unrelated
 * `tricks`-table re-emits. Gating on it would flip a steady edit session to
 * "loading", unmounting `TrickForm` and dropping the user's typed text (#217).
 */
function deriveSheetMode(
  editingTrickId: TrickId | null,
  editingTrick: ParsedTrick | null
): TrickFormSheetMode {
  if (editingTrickId === null) {
    return { mode: "create" };
  }
  if (editingTrick !== null && editingTrick.id === editingTrickId) {
    return { mode: "edit", trick: editingTrick };
  }
  return { mode: "loading" };
}

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
  const { tricks, error: tricksError } = useTricks({
    search: debouncedSearch,
    status: statusFilter,
    category: categoryFilter,
    sort: SORT_MAP[sort],
  });

  const {
    trick: editingTrick,
    error: editingTrickError,
    hasSettled: editingTrickSettled,
  } = useTrick(editingTrickId);
  const { tags, error: tagError } = useTags();
  const { createTrick, updateTrick, deleteTrick } = useTrickMutations();
  const { createTag } = useTagMutations();
  const { categories, error: categoriesError } = useTrickCategories();
  const { effectTypes, error: effectTypesError } = useTrickEffectTypes();

  // ---------------------------------------------------------------------------
  // Trick-tags join query (build a Map<trickId, ParsedTag[]>)
  // ---------------------------------------------------------------------------
  const {
    data: trickTagRows,
    error: trickTagError,
    isLoading: trickTagsLoading,
  } = useQuery<TrickTagRow>(TRICK_TAGS_QUERY);

  const trickTagMap = buildTrickTagMap(trickTagRows);

  // Selection hook — sentinel-null + lock-in seeding. See `useHydratedSelection`
  // and `.claude/rules/new-feature.md` for the rationale (issue #216).
  const tagsSel = useHydratedSelection<TagId>({
    editingId: editingTrickId,
    isLoading: trickTagsLoading,
    seed: () =>
      editingTrickId === null
        ? []
        : (trickTagMap.get(editingTrickId) ?? []).map((tag) => tag.id),
  });

  // Discriminated mode for the form sheet. "edit" requires the loaded row's id
  // to match editingTrickId; everything else under a non-null editingTrickId is
  // "loading" — the in-flight window, or a stale row during an Edit→Edit target
  // switch. Keeps the sheet from rendering "Add trick" + an empty form while
  // useTrick hydrates (issue #217). See deriveSheetMode for why identity beats
  // isLoading.
  const sheetMode = deriveSheetMode(editingTrickId, editingTrick);

  // True while an Edit session is open and the trick row or trick_tags join
  // is still hydrating. Gates Save (so a keyboard submit can't write empty
  // diffs against a stale [] baseline) and swaps the picker for a skeleton.
  // Add path is never gated because handleAddTrick seeds via seedEmpty().
  //
  // The row-loading term is `sheetMode.mode === "loading"`, NOT the folded
  // `isLoading` from useTrick: the latter folds PowerSync's `isFetching`,
  // which flickers true on unrelated `tricks`-table re-emits and would
  // otherwise disable Save + skeleton the picker mid-edit-session. sheetMode
  // keys on row identity, so it stays "edit" through the flicker (issue #217).
  //
  // `editingTrickError != null` is folded in too: when the row query errored
  // but a stale matching `editingTrick` is still present, sheetMode reads
  // "edit" for the frame before the close effect fires — Save must stay
  // gated through that transient window.
  const relationsLoading =
    editingTrickId !== null &&
    (sheetMode.mode === "loading" ||
      tagsSel.isHydrating ||
      editingTrickError != null);

  // ---------------------------------------------------------------------------
  // Trick-items join query (build a Map<trickId, LinkedItem[]>)
  // ---------------------------------------------------------------------------
  const { data: trickItemRows, error: trickItemError } =
    useQuery<TrickItemRow>(TRICK_ITEMS_QUERY);

  // ---------------------------------------------------------------------------
  // Toast on any relation-query failure so the user is informed even before
  // clicking Edit/Add. Stable id so re-renders dedupe. Mirrors the unified
  // shape used in collect-view for consistency. The asymmetry between these
  // errors only matters for auto-close behavior (next effect) and handler
  // gating, not for toast surfacing — all critical errors should inform the
  // user equally (issue #218 + #263).
  //
  // Picker-source vs junction distinction:
  //   - tagError       → useTags() (the picker source); gates both Add and
  //                      Edit because the picker is used in both flows.
  //   - trickTagError  → trick_tags join; gates Edit only (it seeds existing
  //                      tag selections on the trick; Add uses seedEmpty()).
  //   - trickItemError → trick_items join; never gates the form at all
  //                      (feeds only the inverse-relation badge in TrickList).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const error = trickTagError ?? trickItemError ?? tagError;
    if (!error) {
      return;
    }
    console.error("[RepertoireView] Relation query error", {
      trickTagError,
      trickItemError,
      tagError,
    });
    toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
  }, [trickTagError, trickItemError, tagError, t]);

  // ---------------------------------------------------------------------------
  // Tricks list error — toast on the list page since tricks are the page's data.
  // Mirrors collect-view's items-list error handling (issue #263 sibling).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (tricksError) {
      console.error("[RepertoireView] Tricks query error:", tricksError);
      toast.error(t("loadError"), { id: LOAD_TRICKS_ERROR_TOAST_ID });
    }
  }, [tricksError, t]);

  // ---------------------------------------------------------------------------
  // Supplementary queries — combobox autocomplete only. Log so we can debug
  // from session reports; do NOT toast (the form still works without
  // category/effect-type suggestions; hardcoded SUGGESTED_* constants in the
  // form provide a fallback). Mirrors the brands/locations precedent in
  // collect-view (issue #263).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (categoriesError) {
      console.error(
        "[RepertoireView] Categories query error:",
        categoriesError
      );
    }
    if (effectTypesError) {
      console.error(
        "[RepertoireView] Effect types query error:",
        effectTypesError
      );
    }
  }, [categoriesError, effectTypesError]);

  // ---------------------------------------------------------------------------
  // Edit target unavailable — close the sheet rather than render "add new".
  // Two cases: the row query errored, or it settled with no row (the trick was
  // deleted out from under us between list render and the useTrick query). Both
  // route through the same close + toast (issue #217). Gates on `hasSettled`
  // (a per-id sticky settle latch exposed by useTrick) instead of the folded
  // `!isLoading`: the fold flickers true on unrelated `tricks`-table re-emits
  // during sync churn, which would unreliably delay the close+toast
  // (issue #287). hasSettled latches on the first quiet render for the
  // current id and stays sticky through subsequent isFetching flickers.
  // ---------------------------------------------------------------------------
  // Derived boolean for the effect dep — depending on `editingTrick` directly
  // would re-fire the effect on every PowerSync re-emit of the row (fresh
  // object identity), which dilutes the per-id sticky settle work in
  // `useTrick`. Only the nullness is load-bearing for the close+toast gate.
  const editingTrickMissing = editingTrick === null;
  useEffect(() => {
    if (editingTrickId === null) {
      return;
    }
    const settledMissing = editingTrickMissing && editingTrickSettled;
    if (!(editingTrickError || settledMissing)) {
      return;
    }
    // Do NOT pass error.message as description — PowerSync/SQLite messages
    // can carry row context or query fragments. Full error already in
    // the log below for developer diagnostics.
    //
    // Log level branches on cause: a genuine query error is developer-
    // actionable (console.error); a settled-missing row is a normal
    // offline-first outcome (concurrent delete on another device) and
    // logs at console.warn.
    const logUnavailable = editingTrickError ? console.error : console.warn;
    logUnavailable(
      "[RepertoireView] Edit target unavailable:",
      editingTrickError ?? "row not found"
    );
    // Split toast ids so the two cases don't dedupe into one another — a
    // settled-missing row is a different surface (the trick was deleted) and
    // a follow-up load-error shouldn't replace it (and vice versa).
    const toastKey = editingTrickError ? "loadError" : "trickNoLongerExists";
    const toastId = editingTrickError
      ? LOAD_EDIT_TRICK_ERROR_TOAST_ID
      : TRICK_NO_LONGER_EXISTS_TOAST_ID;
    toast.error(t(toastKey), { id: toastId });
    // Force-close discards any unsaved input in the sheet — this path has no
    // discard-dialog interception (unlike a user-driven close). Accepted
    // trade-off: the target row no longer exists, so there's nothing to keep
    // editing against. Draft recovery is intentionally out of scope (#288 F2).
    setSheetOpen(false);
    setEditingTrickId(null);
    tagsSel.reset();
  }, [
    editingTrickId,
    editingTrickMissing,
    editingTrickError,
    editingTrickSettled,
    t,
    tagsSel.reset,
  ]);

  // ---------------------------------------------------------------------------
  // If a critical error fires while the sheet is open, close it rather than
  // let the user save against an empty seed lock-in or an empty tag picker.
  // Mode-scoped to match the handler-entry guards (issue #218 + #263 matrix):
  //   - Edit (editingTrickId !== null): trickTagError (existing-tag seed)
  //     or tagError (picker source) → close.
  //   - Add  (editingTrickId === null): only tagError matters — the picker
  //     source is used in both flows; trick_tags doesn't feed Add (seedEmpty).
  // trickItemError is intentionally NOT in either branch — it feeds only the
  // inverse-relation badge in TrickList, never the edit form.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    const inEditMode = editingTrickId !== null;
    const shouldClose = Boolean(
      inEditMode ? trickTagError || tagError : tagError
    );
    if (shouldClose) {
      setSheetOpen(false);
      setEditingTrickId(null);
      tagsSel.reset();
    }
  }, [sheetOpen, editingTrickId, trickTagError, tagError, tagsSel.reset]);

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
    // tagError breaks the picker source; without it the user would create a
    // trick they can't tag (issue #263). The trick-scoped join (trickTagError)
    // is edit-only and not checked here — Add seeds via seedEmpty().
    if (tagError) {
      toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
      return;
    }
    setEditingTrickId(null);
    tagsSel.seedEmpty();
    setSheetOpen(true);
  }

  function handleEditTrick(id: TrickId): void {
    // Block opening the sheet if trick_tags is broken — without it the seed
    // lock-in would be empty and the user can't see what they have or
    // remove what they've toggled (issue #218). tagError additionally blocks
    // because the picker has no tags to render even with a valid seed (#263).
    if (trickTagError || tagError) {
      toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
      return;
    }
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
          toast.error(t("loadError"), { id: LOAD_RELATIONS_ERROR_TOAST_ID });
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
      console.error("[RepertoireView] Failed to save trick:", error);
      const errorKey = getMutationErrorKey(error);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        toast.error(t("saveFailed"));
      }
      // Re-throw so the child TrickFormSheet's handleFormSubmit catches it and
      // skips its post-await setFormDirty(false) — keeps RHF isDirty and the
      // local formDirty mirror in sync when save fails. Mirrors collect-view.
      throw error;
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
      console.error("[RepertoireView] Failed to delete trick:", error);
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

  async function handleCreateTag(name: string): Promise<TagId> {
    try {
      return await createTag(name);
    } catch (error) {
      // TagPicker owns the user-facing toast; we only log and rethrow so the
      // child component can reset its UI state. Avoid duplicate toasts here.
      console.error("[RepertoireView] Tag create failed:", error);
      throw error;
    }
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
          linkedItemsError={Boolean(trickItemError)}
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
        mode={sheetMode}
        onCreateTag={handleCreateTag}
        onOpenChange={handleSheetOpenChange}
        onSubmit={handleSubmit}
        onToggleTag={tagsSel.toggle}
        open={sheetOpen}
        relationsLoading={relationsLoading}
        selectedTagIds={tagsSel.selected}
        tagsDirty={tagsDirty}
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
