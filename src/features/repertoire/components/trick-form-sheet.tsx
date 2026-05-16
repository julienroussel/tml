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
import type { TagId } from "@/db/types";
import type { TrickFormValues } from "../schema";
import type { ParsedTag, ParsedTrick } from "../types";
import { TrickForm } from "./trick-form";

const FORM_ID = "trick-form";

/**
 * Discriminated edit-target state for the sheet. The parent derives it from
 * `editingTrickId` and the `useTrick` query so the sheet never infers intent
 * from a nullable `trick` — that conflated "creating" / "loading" /
 * "load-failed" into one `null` (issue #217). No `error` variant: the parent
 * closes the sheet on load failure, so the sheet only ever renders create /
 * loading / edit.
 */
type TrickFormSheetMode =
  | { mode: "create" }
  | { mode: "loading" }
  | { mode: "edit"; trick: ParsedTrick };

interface TrickFormSheetProps {
  availableTags: ParsedTag[];
  categories: string[];
  effectTypes: string[];
  mode: TrickFormSheetMode;
  onCreateTag: (name: string) => Promise<TagId>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TrickFormValues) => void | Promise<void>;
  onToggleTag: (tagId: TagId) => void;
  open: boolean;
  /**
   * True while an Edit session's trick row + tag join are still hydrating.
   * Disables Save (so a keyboard submit cannot fire against an unseeded
   * baseline) and renders a skeleton in place of the picker. Issue #216.
   */
  relationsLoading?: boolean;
  selectedTagIds: TagId[];
  tagsDirty?: boolean;
}

/** Convert a ParsedTrick to partial form default values. */
function toFormDefaults(trick: ParsedTrick): Partial<TrickFormValues> {
  return {
    angleSensitivity: trick.angleSensitivity,
    category: trick.category ?? "",
    description: trick.description ?? "",
    difficulty: trick.difficulty,
    duration: trick.duration,
    effectType: trick.effectType ?? "",
    isCameraFriendly: trick.isCameraFriendly,
    isSilent: trick.isSilent,
    languages: trick.languages,
    music: trick.music ?? "",
    name: trick.name,
    notes: trick.notes ?? "",
    performanceType: trick.performanceType,
    props: trick.props ?? "",
    source: trick.source ?? "",
    status: trick.status,
    videoUrl: trick.videoUrl ?? "",
  };
}

function TrickFormSheet({
  open,
  onOpenChange,
  mode,
  selectedTagIds,
  availableTags,
  onToggleTag,
  onCreateTag,
  onSubmit,
  categories,
  effectTypes,
  relationsLoading = false,
  tagsDirty = false,
}: TrickFormSheetProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const isEditing = mode.mode !== "create";
  const [formDirty, setFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Reset form dirty state when the sheet opens (new trick or different edit
  // target). The key prop on TrickForm already handles React-level remounting,
  // but the local formDirty state must also be reset. Mirrors item-form-sheet.
  // Also keys on the edit-target id so an Edit→Edit switch (without a
  // close-and-reopen) clears the prior session's dirty mirror.
  const editTargetId = mode.mode === "edit" ? mode.trick.id : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: editTargetId is the trigger for the Edit→Edit reset; the body only reads `open` but re-running on id change is the whole point of this effect.
  useEffect(() => {
    if (open) {
      setFormDirty(false);
      setIsSubmitting(false);
    }
  }, [open, editTargetId]);

  const isDirty = formDirty || tagsDirty;

  function handleDiscard(): void {
    setShowDiscardDialog(false);
    onOpenChange(false);
  }

  async function handleFormSubmit(data: TrickFormValues): Promise<void> {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      // Clear local dirty mirror so the discard dialog doesn't fire if the
      // parent's close path routes through Sheet's onOpenChange after save.
      setFormDirty(false);
    } catch (error) {
      // Parent (repertoire-view) owns user-facing toast; log defensively here
      // so a forgotten parent try/catch doesn't leave the UI stuck submitting.
      console.error("Trick form submit failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Sheet
        onOpenChange={(nextOpen) => {
          // Intercept Sheet-driven closes (escape key, click-outside): a dirty
          // form routes through the discard dialog instead of closing. Replaces
          // the old window.confirm guard wired to onEscapeKeyDown /
          // onInteractOutside.
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
            <SheetTitle>
              {isEditing ? t("editTrick") : t("addTrick")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {isEditing ? t("editTrickDescription") : t("addTrickDescription")}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4">
              {mode.mode === "loading" ? (
                <div
                  aria-busy={true}
                  aria-label={t("loadingTrick")}
                  className="flex flex-col gap-4"
                  role="status"
                >
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-2/3" />
                </div>
              ) : (
                <TrickForm
                  availableTags={availableTags}
                  defaultValues={
                    mode.mode === "edit"
                      ? toFormDefaults(mode.trick)
                      : undefined
                  }
                  formId={FORM_ID}
                  key={mode.mode === "edit" ? mode.trick.id : "new"}
                  onCreateTag={onCreateTag}
                  onDirtyChange={setFormDirty}
                  onSubmit={handleFormSubmit}
                  onToggleTag={onToggleTag}
                  relationsLoading={relationsLoading}
                  selectedTagIds={selectedTagIds}
                  userCategories={categories}
                  userEffectTypes={effectTypes}
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

export type { TrickFormSheetMode, TrickFormSheetProps };
export { TrickFormSheet };
