"use client";

import { CheckIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TagId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import { cn } from "@/lib/utils";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

interface TagPickerProps {
  availableTags: ParsedTag[];
  maxTags?: number;
  onCreateTag: (name: string) => Promise<TagId>;
  onToggleTag: (tagId: TagId) => void;
  selectedTagIds: TagId[];
}

function TagPicker({
  selectedTagIds,
  availableTags,
  onToggleTag,
  onCreateTag,
  maxTags,
}: TagPickerProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const announcementRef = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(selectedTagIds);
  const atLimit = maxTags !== undefined && selectedTagIds.length >= maxTags;

  const trimmedSearch = search.trim();
  const exactMatch = availableTags.some(
    (tag) => tag.name.toLowerCase() === trimmedSearch.toLowerCase()
  );
  const showCreateOption = trimmedSearch.length > 0 && !exactMatch && !creating;

  const filteredTags = trimmedSearch
    ? availableTags.filter((tag) =>
        tag.name.toLowerCase().includes(trimmedSearch.toLowerCase())
      )
    : availableTags;

  const selectedTags = availableTags.filter((tag) => selectedSet.has(tag.id));

  function announce(message: string): void {
    if (announcementRef.current) {
      announcementRef.current.textContent = message;
    }
  }

  function handleToggle(tag: ParsedTag): void {
    const isSelected = selectedSet.has(tag.id);

    if (!isSelected && atLimit) {
      return;
    }

    onToggleTag(tag.id);
    announce(
      isSelected
        ? t("tagPicker.removedTag", { name: tag.name })
        : t("tagPicker.addedTag", { name: tag.name })
    );
  }

  async function handleCreate(): Promise<void> {
    if (!trimmedSearch || creating) {
      return;
    }

    setCreating(true);
    try {
      const newId = await onCreateTag(trimmedSearch);
      onToggleTag(newId);
      announce(t("tagPicker.createdTag", { name: trimmedSearch }));
      setSearch("");
    } catch {
      // Tag creation failed (e.g., duplicate name). The mutation hook
      // already wraps the error — surface it as a toast so the form
      // stays open instead of crashing via the error boundary.
      toast.error(t("tagPicker.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  function handleRemove(tag: ParsedTag): void {
    onToggleTag(tag.id);
    announce(t("tagPicker.removedTag", { name: tag.name }));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        aria-live="polite"
        className="sr-only"
        ref={announcementRef}
        role="status"
      />

      <Popover
        onOpenChange={(next) => {
          if (!creating) {
            setOpen(next);
          }
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-label={t("tagPicker.search")}
            className="min-h-11 w-full justify-between"
            variant="outline"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <SearchIcon className="size-4" />
              <span>{t("tagPicker.search")}</span>
            </span>
            {selectedTagIds.length > 0 && (
              <Badge className="ml-auto" variant="secondary">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={setSearch}
              placeholder={t("tagPicker.search")}
              value={search}
            />
            <CommandList>
              <CommandEmpty>{t("tagPicker.noResults")}</CommandEmpty>
              {showCreateOption && (
                <CommandGroup>
                  <CommandItem
                    className="min-h-11"
                    disabled={creating || atLimit}
                    onSelect={() => {
                      handleCreate();
                    }}
                  >
                    <PlusIcon className="size-4" />
                    <span>
                      {t("tagPicker.create", { name: trimmedSearch })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {filteredTags.map((tag) => {
                  const isSelected = selectedSet.has(tag.id);
                  const isDisabled = !isSelected && atLimit;

                  return (
                    <CommandItem
                      className="min-h-11"
                      disabled={isDisabled}
                      key={tag.id}
                      onSelect={() => handleToggle(tag)}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex items-center gap-2">
                        <span>{tag.name}</span>
                        {tag.color && HEX_COLOR_RE.test(tag.color) && (
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <ul
          aria-label={t("tagPicker.selectedTags")}
          className="flex flex-wrap gap-1.5"
        >
          {selectedTags.map((tag) => (
            <li key={tag.id}>
              <Badge className="gap-1 py-1 pr-1 pl-2" variant="secondary">
                {tag.color && HEX_COLOR_RE.test(tag.color) && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tag.name}</span>
                <button
                  aria-label={t("tagPicker.remove", { name: tag.name })}
                  className="relative flex items-center justify-center rounded-sm p-1.5 before:absolute before:inset-[-8px] before:content-[''] hover:bg-accent"
                  onClick={() => handleRemove(tag)}
                  type="button"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { TagPickerProps };
export { TagPicker };
