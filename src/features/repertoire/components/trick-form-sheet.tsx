"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import type { TagId } from "@/db/types";
import type { TrickFormValues } from "../schema";
import type { ParsedTag, ParsedTrick } from "../types";
import { TrickForm } from "./trick-form";

const FORM_ID = "trick-form";

interface TrickFormSheetProps {
  availableTags: ParsedTag[];
  categories: string[];
  effectTypes: string[];
  onCreateTag: (name: string) => Promise<TagId>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TrickFormValues) => void;
  onToggleTag: (tagId: TagId) => void;
  open: boolean;
  selectedTagIds: TagId[];
  submitting?: boolean;
  tagsDirty?: boolean;
  trick: ParsedTrick | null;
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
  trick,
  selectedTagIds,
  availableTags,
  onToggleTag,
  onCreateTag,
  onSubmit,
  categories,
  effectTypes,
  submitting = false,
  tagsDirty = false,
}: TrickFormSheetProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const isEditing = trick !== null;
  const [formDirty, setFormDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = formDirty || tagsDirty;

  function guardDismiss(event: Event): void {
    // biome-ignore lint/suspicious/noAlert: confirm dialog is the simplest UX for unsaved-changes guard — no custom modal needed
    if (dirtyRef.current && !window.confirm(t("unsavedChanges"))) {
      event.preventDefault();
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex flex-col gap-0 p-0 sm:max-w-md"
        onEscapeKeyDown={guardDismiss}
        onInteractOutside={guardDismiss}
        side="right"
      >
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>{isEditing ? t("editTrick") : t("addTrick")}</SheetTitle>
          <SheetDescription className="sr-only">
            {isEditing ? t("editTrickDescription") : t("addTrickDescription")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            <TrickForm
              availableTags={availableTags}
              defaultValues={trick ? toFormDefaults(trick) : undefined}
              formId={FORM_ID}
              key={trick?.id ?? "new"}
              onCreateTag={onCreateTag}
              onDirtyChange={setFormDirty}
              onSubmit={onSubmit}
              onToggleTag={onToggleTag}
              selectedTagIds={selectedTagIds}
              userCategories={categories}
              userEffectTypes={effectTypes}
            />
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-4">
          <Button
            onClick={() => {
              // biome-ignore lint/suspicious/noAlert: confirm dialog is the simplest UX for unsaved-changes guard
              if (dirtyRef.current && !window.confirm(t("unsavedChanges"))) {
                return;
              }
              onOpenChange(false);
            }}
            type="button"
            variant="ghost"
          >
            {t("cancel")}
          </Button>
          <Button disabled={submitting} form={FORM_ID} type="submit">
            {t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export type { TrickFormSheetProps };
export { TrickFormSheet };
