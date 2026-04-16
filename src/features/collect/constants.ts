const ITEM_TYPES = [
  "prop",
  "book",
  "gimmick",
  "dvd",
  "download",
  "deck",
  "clothing",
  "consumable",
  "accessory",
  "other",
] as const;

type ItemType = (typeof ITEM_TYPES)[number];

interface TypeConfig {
  readonly label: string;
  readonly variant: "default" | "secondary" | "destructive" | "outline";
}

const TYPE_CONFIG = {
  prop: { label: "type.prop", variant: "default" },
  book: { label: "type.book", variant: "secondary" },
  gimmick: { label: "type.gimmick", variant: "default" },
  dvd: { label: "type.dvd", variant: "outline" },
  download: { label: "type.download", variant: "outline" },
  deck: { label: "type.deck", variant: "secondary" },
  clothing: { label: "type.clothing", variant: "outline" },
  consumable: { label: "type.consumable", variant: "outline" },
  accessory: { label: "type.accessory", variant: "secondary" },
  other: { label: "type.other", variant: "outline" },
} as const satisfies Record<ItemType, TypeConfig>;

const ITEM_CONDITIONS = ["new", "good", "worn", "needs_repair"] as const;

type ItemCondition = (typeof ITEM_CONDITIONS)[number];

interface ConditionConfig {
  readonly label: string;
  readonly variant: "default" | "secondary" | "destructive" | "outline";
}

const CONDITION_CONFIG = {
  new: { label: "condition.new", variant: "default" },
  good: { label: "condition.good", variant: "secondary" },
  worn: { label: "condition.worn", variant: "outline" },
  needs_repair: { label: "condition.needs_repair", variant: "destructive" },
} as const satisfies Record<ItemCondition, ConditionConfig>;

const SUGGESTED_BRANDS = [
  "Bicycle",
  "Theory11",
  "Ellusionist",
  "Murphy's Magic",
  "Penguin Magic",
  "Vanishing Inc.",
  "Card-Shark",
  "TCC",
] as const;

const SUGGESTED_LOCATIONS = [
  "Close-up case",
  "Stage case",
  "Home office",
  "Storage room",
  "Car trunk",
  "Performing bag",
] as const;

const MAX_TAGS_PER_ITEM = 20;
const MAX_TRICKS_PER_ITEM = 50;

/**
 * Canonical sort keys shared by ItemFilters (UI), useItems (hook), and
 * collect-view (orchestration). Kebab-case to match SelectItem `value` props.
 */
const ITEM_SORTS = [
  "newest",
  "oldest",
  "name-asc",
  "name-desc",
  "price-asc",
  "price-desc",
  "type-asc",
] as const;

type FilterSortValue = (typeof ITEM_SORTS)[number];

function isItemType(value: unknown): value is ItemType {
  return (
    typeof value === "string" &&
    (ITEM_TYPES as readonly string[]).includes(value)
  );
}

function isItemCondition(value: unknown): value is ItemCondition {
  return (
    typeof value === "string" &&
    (ITEM_CONDITIONS as readonly string[]).includes(value)
  );
}

function isFilterSortValue(value: unknown): value is FilterSortValue {
  return (
    typeof value === "string" &&
    (ITEM_SORTS as readonly string[]).includes(value)
  );
}

export type { FilterSortValue, ItemCondition, ItemType };
export {
  CONDITION_CONFIG,
  ITEM_CONDITIONS,
  ITEM_SORTS,
  ITEM_TYPES,
  isFilterSortValue,
  isItemCondition,
  isItemType,
  MAX_TAGS_PER_ITEM,
  MAX_TRICKS_PER_ITEM,
  SUGGESTED_BRANDS,
  SUGGESTED_LOCATIONS,
  TYPE_CONFIG,
};
