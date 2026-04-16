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
import type { TagId, TrickId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import type { ItemFormValues } from "../schema";
import type { LinkedTrick, ParsedItem } from "../types";
import { ItemForm } from "./item-form";

const FORM_ID = "item-form";

interface ItemFormSheetProps {
  availableTags: ParsedTag[];
  availableTricks: LinkedTrick[];
  item: ParsedItem | null;
  onCreateTag: (name: string) => Promise<TagId>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ItemFormValues) => void | Promise<void>;
  onToggleTag: (tagId: TagId) => void;
  onToggleTrick: (trickId: TrickId) => void;
  open: boolean;
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
  item,
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
  tagsDirty = false,
  tricksDirty = false,
}: ItemFormSheetProps): React.ReactElement {
  const t = useTranslations("collect");
  const isEditing = item !== null;
  const [formDirty, setFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Reset form dirty state when the sheet opens (new item or different edit target).
  // The key prop on ItemForm already handles React-level remounting, but the
  // local formDirty state must also be reset.
  useEffect(() => {
    if (open) {
      setFormDirty(false);
      setIsSubmitting(false);
    }
  }, [open]);

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
              <ItemForm
                availableTags={availableTags}
                availableTricks={availableTricks}
                defaultValues={item ? toFormDefaults(item) : undefined}
                formId={FORM_ID}
                key={item?.id ?? "new"}
                onCreateTag={onCreateTag}
                onDirtyChange={setFormDirty}
                onSubmit={handleFormSubmit}
                onToggleTag={onToggleTag}
                onToggleTrick={onToggleTrick}
                selectedTagIds={selectedTagIds}
                selectedTrickIds={selectedTrickIds}
                userBrands={userBrands}
                userLocations={userLocations}
              />
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
            <Button disabled={isSubmitting} form={FORM_ID} type="submit">
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
              {t("unsavedChanges")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} variant="destructive">
              {t("discardAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export type { ItemFormSheetProps };
export { ItemFormSheet };
