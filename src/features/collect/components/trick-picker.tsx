"use client";

import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import type { TrickId } from "@/db/types";
import { cn } from "@/lib/utils";
import type { LinkedTrick } from "../types";

interface TrickPickerProps {
  availableTricks: LinkedTrick[];
  maxTricks?: number;
  onToggleTrick: (trickId: TrickId) => void;
  selectedTrickIds: TrickId[];
}

function TrickPicker({
  selectedTrickIds,
  availableTricks,
  onToggleTrick,
  maxTricks,
}: TrickPickerProps): React.ReactElement {
  const t = useTranslations("collect");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const announcementRef = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(selectedTrickIds);
  const atLimit =
    maxTricks !== undefined && selectedTrickIds.length >= maxTricks;

  const trimmedSearch = search.trim();

  const filteredTricks = trimmedSearch
    ? availableTricks.filter((trick) =>
        trick.name.toLowerCase().includes(trimmedSearch.toLowerCase())
      )
    : availableTricks;

  const selectedTricks = availableTricks.filter((trick) =>
    selectedSet.has(trick.id)
  );

  function announce(message: string): void {
    if (announcementRef.current) {
      announcementRef.current.textContent = message;
    }
  }

  function handleToggle(trick: LinkedTrick): void {
    const isSelected = selectedSet.has(trick.id);

    if (!isSelected && atLimit) {
      return;
    }

    onToggleTrick(trick.id);
    announce(
      isSelected
        ? t("trickPicker.removedTrick", { name: trick.name })
        : t("trickPicker.addedTrick", { name: trick.name })
    );
  }

  function handleRemove(trick: LinkedTrick): void {
    onToggleTrick(trick.id);
    announce(t("trickPicker.removedTrick", { name: trick.name }));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        aria-live="polite"
        className="sr-only"
        ref={announcementRef}
        role="status"
      />

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-label={t("trickPicker.search")}
            className="min-h-11 w-full justify-between"
            variant="outline"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <SearchIcon className="size-4" />
              <span>{t("trickPicker.search")}</span>
            </span>
            {selectedTrickIds.length > 0 && (
              <Badge className="ml-auto" variant="secondary">
                {selectedTrickIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={setSearch}
              placeholder={t("trickPicker.search")}
              value={search}
            />
            <CommandList>
              <CommandEmpty>{t("trickPicker.noResults")}</CommandEmpty>
              <CommandGroup>
                {filteredTricks.map((trick) => {
                  const isSelected = selectedSet.has(trick.id);
                  const isDisabled = !isSelected && atLimit;

                  return (
                    <CommandItem
                      className="min-h-11"
                      disabled={isDisabled}
                      key={trick.id}
                      onSelect={() => handleToggle(trick)}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{trick.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTricks.length > 0 && (
        <ul
          aria-label={t("trickPicker.selectedTricks")}
          className="flex flex-wrap gap-1.5"
        >
          {selectedTricks.map((trick) => (
            <li key={trick.id}>
              <Badge
                className="gap-1 overflow-visible py-1 pr-1 pl-2"
                variant="secondary"
              >
                <span>{trick.name}</span>
                <button
                  aria-label={t("trickPicker.remove", { name: trick.name })}
                  className="relative flex min-h-11 min-w-11 items-center justify-center rounded-sm p-1.5 hover:bg-accent"
                  onClick={() => handleRemove(trick)}
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

export type { TrickPickerProps };
export { TrickPicker };
