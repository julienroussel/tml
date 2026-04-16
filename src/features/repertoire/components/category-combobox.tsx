"use client";

import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
import { cn } from "@/lib/utils";

interface CategoryComboboxProps {
  label?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: readonly string[];
  /** i18n namespace containing combobox.* keys. Defaults to "repertoire". */
  translationNamespace?: string;
  userValues: string[];
  value: string;
}

function buildOptions(
  suggestions: readonly string[],
  userValues: string[]
): string[] {
  const unique = new Set<string>();
  for (const s of suggestions) {
    unique.add(s);
  }
  for (const u of userValues) {
    unique.add(u);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

function CategoryCombobox({
  value,
  onChange,
  suggestions,
  userValues,
  placeholder,
  label,
  translationNamespace = "repertoire",
}: CategoryComboboxProps): React.ReactElement {
  const t = useTranslations(translationNamespace);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const displayPlaceholder = placeholder ?? t("combobox.select");

  const options = buildOptions(suggestions, userValues);

  const trimmedSearch = search.trim();
  const exactMatch = options.some(
    (option) => option.toLowerCase() === trimmedSearch.toLowerCase()
  );
  const showCustomOption = trimmedSearch.length > 0 && !exactMatch;

  function handleSelect(selected: string): void {
    onChange(selected);
    setSearch("");
    setOpen(false);
  }

  function handleClear(event: React.MouseEvent): void {
    event.stopPropagation();
    onChange("");
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div className="flex items-center gap-1">
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-label={label ?? displayPlaceholder}
            className="min-h-11 w-full justify-between"
            role="combobox"
            variant="outline"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || displayPlaceholder}
            </span>
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {value && (
          <button
            aria-label={t("combobox.clearSelection")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={handleClear}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearch}
            placeholder={displayPlaceholder}
            value={search}
          />
          <CommandList>
            <CommandEmpty>{t("combobox.noResults")}</CommandEmpty>
            {showCustomOption && (
              <CommandGroup>
                <CommandItem
                  className="min-h-11"
                  onSelect={() => handleSelect(trimmedSearch)}
                >
                  <PlusIcon className="size-4" />
                  <span>
                    {t("combobox.useCustom", { value: trimmedSearch })}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options
                .filter((option) =>
                  option.toLowerCase().includes(trimmedSearch.toLowerCase())
                )
                .map((option) => (
                  <CommandItem
                    className="min-h-11"
                    key={option}
                    onSelect={() => handleSelect(option)}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{option}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type { CategoryComboboxProps };
export { CategoryCombobox };
