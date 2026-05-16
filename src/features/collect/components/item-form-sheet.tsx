"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { TagId, TrickId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import type { ItemFormValues } from "../schema";
import type { LinkedTrick, ParsedItem } from "../types";
import { ItemForm } from "./item-form";

const FORM_ID = "item-form";

/**
 * Discriminated edit-target state for the sheet. The parent derives it from
 * `editingItemId` and the `useItem` query so the sheet never infers intent from
 * a nullable `item` — that conflated "creating" / "loading" / "load-failed"
 * into one `null` (issue #217). No `error` variant: the parent closes the sheet
 * on load failure, so the sheet only ever renders create / loading / edit.
 */
type ItemFormSheetMode =
  | { mode: "create" }
  | { mode: "loading" }
  | { mode: "edit"; item: ParsedItem };

interface ItemFormSheetProps {
  availableTags: ParsedTag[];
  availableTricks: LinkedTrick[];
  mode: ItemFormSheetMode;
  onCreateTag: (name: string) => Promise<TagId>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ItemFormValues) => void | Promise<void>;
  onToggleTag: (tagId: TagId) => void;
  onToggleTrick: (trickId: TrickId) => void;
  open: boolean;
  /**
   * True while an Edit session's row + tag/trick joins are still hydrating.
   * Disables Save (so a keyboard submit cannot fire against an unseeded
   * baseline) and renders skeletons in place of the pickers. Issue #216.
   */
  relationsLoading?: boolean;
  selectedTagIds: TagId[];
  selectedTrickIds: TrickId[];
  tagsDirty?: boolean;
  tricksDirty?: boolean;
  userBrands: string[];
  userLocations: string[];
}

/** Convert a ParsedItem to partial form default values. */
function toFormDefaults(item: ParsedItem): Partial<ItemFormValues> {
  return {
    brand: item.brand ?? "",
    condition: item.condition,
    creator: item.creator ?? "",
    description: item.description ?? "",
    location: item.location ?? "",
    name: item.name,
    notes: item.notes ?? "",
    purchaseDate: item.purchaseDate ?? "",
    purchasePrice:
      item.purchasePrice === null ? "" : String(item.purchasePrice),
    quantity: item.quantity,
    type: item.type,
    url: item.url ?? "",
  };
}

function ItemFormSheet({
  open,
  onOpenChange,
  mode,
  selectedTagIds,
  availableTags,
  onToggleTag,
  onCreateTag,
  selectedTrickIds,
  availableTricks,
  onToggleTrick,
  onSubmit,
  userBrands,
  userLocations,
  relationsLoading = false,
  tagsDirty = false,
  tricksDirty = false,
}: ItemFormSheetProps): React.ReactElement {
  const t = useTranslations("collect");
  const isEditing = mode.mode !== "create";
  const [formDirty, setFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Reset form dirty state when the sheet opens or when the edit target id
  // changes while the sheet stays open (Edit→Edit switch). The key prop on
  // ItemForm already handles React-level remounting, but the local formDirty
  // state must also be reset.
  const editTargetId = mode.mode === "edit" ? mode.item.id : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: editTargetId is the trigger for the Edit→Edit reset; the body only reads `open` but re-running on id change is the whole point of this effect.
  useEffect(() => {
    if (open) {
      setFormDirty(false);
      setIsSubmitting(false);
    }
  }, [open, editTargetId]);

  const isDirty = formDirty || tagsDirty || tricksDirty;

  function handleDiscard(): void {
    setShowDiscardDialog(false);
    onOpenChange(false);
  }

  async function handleFormSubmit(data: ItemFormValues): Promise<void> {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      // Clear local dirty mirror so the discard dialog doesn't fire if the
      // parent's close path routes through Sheet's onOpenChange after save.
      setFormDirty(false);
    } catch (error) {
      // Parent (collect-view) owns user-facing toast; log defensively here so
      // a forgotten parent try/catch doesn't leave the UI stuck submitting.
      console.error("Item form submit failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Sheet
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isDirty) {
            setShowDiscardDialog(true);
            return;
          }
          onOpenChange(nextOpen);
        }}
        open={open}
      >
        <SheetContent
          className="flex flex-col gap-0 p-0 sm:max-w-md"
          side="right"
        >
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle>{isEditing ? t("editItem") : t("addItem")}</SheetTitle>
            <SheetDescription className="sr-only">
              {isEditing ? t("editItemDescription") : t("addItemDescription")}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4">
              {mode.mode === "loading" ? (
                <div
                  aria-busy={true}
                  aria-label={t("loadingItem")}
                  className="flex flex-col gap-4"
                  role="status"
                >
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-2/3" />
                </div>
              ) : (
                <ItemForm
                  availableTags={availableTags}
                  availableTricks={availableTricks}
                  defaultValues={
                    mode.mode === "edit" ? toFormDefaults(mode.item) : undefined
                  }
                  formId={FORM_ID}
                  key={mode.mode === "edit" ? mode.item.id : "new"}
                  onCreateTag={onCreateTag}
                  onDirtyChange={setFormDirty}
                  onSubmit={handleFormSubmit}
                  onToggleTag={onToggleTag}
                  onToggleTrick={onToggleTrick}
                  relationsLoading={relationsLoading}
                  selectedTagIds={selectedTagIds}
                  selectedTrickIds={selectedTrickIds}
                  userBrands={userBrands}
                  userLocations={userLocations}
                />
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-4">
            <Button
              onClick={() => {
                if (isDirty) {
                  setShowDiscardDialog(true);
                  return;
                }
                onOpenChange(false);
              }}
              type="button"
              variant="ghost"
            >
              {t("cancel")}
            </Button>
            <Button
              aria-busy={
                isSubmitting || relationsLoading || mode.mode === "loading"
              }
              disabled={
                isSubmitting || relationsLoading || mode.mode === "loading"
              }
              form={FORM_ID}
              type="submit"
            >
              {t("save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog onOpenChange={setShowDiscardDialog} open={showDiscardDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discardChangesTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepEditing")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} variant="destructive">
              {t("discardAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export type { ItemFormSheetMode, ItemFormSheetProps };
export { ItemFormSheet };
