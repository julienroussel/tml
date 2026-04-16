"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import {
  FormMessage as BaseFormMessage,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TagId, TrickId } from "@/db/types";
import { CategoryCombobox } from "@/features/repertoire/components/category-combobox";
import { FormSection } from "@/features/repertoire/components/form-section";
import { TagPicker } from "@/features/repertoire/components/tag-picker";
import type { ParsedTag } from "@/features/repertoire/types";
import {
  CONDITION_CONFIG,
  ITEM_CONDITIONS,
  ITEM_TYPES,
  isItemCondition,
  MAX_TAGS_PER_ITEM,
  MAX_TRICKS_PER_ITEM,
  SUGGESTED_BRANDS,
  SUGGESTED_LOCATIONS,
  TYPE_CONFIG,
} from "../constants";
import { type ItemFormValues, itemFormSchema } from "../schema";
import type { LinkedTrick } from "../types";
import { PriceInput } from "./price-input";
import { TrickPicker } from "./trick-picker";

/**
 * Schema input type — fields with `.optional().default(...)` are `T | undefined`
 * before parsing (the resolver fills in defaults to produce ItemFormValues).
 * RHF stores this input shape; handleSubmit receives the parsed output.
 */
type ItemFormInput = z.input<typeof itemFormSchema>;

/** Sentinel value for nullable Select fields (Radix Select doesn't support empty string values). */
const NONE = "__none__";

/**
 * FormMessage wrapper that translates Zod validation keys (e.g. "validation.nameRequired")
 * via the collect i18n namespace so users see localized text instead of raw keys.
 */
function FormMessage(
  props: React.ComponentProps<typeof BaseFormMessage>
): React.ReactElement | null {
  const t = useTranslations("collect");
  const { error, formMessageId } = useFormField();
  const raw = error?.message;

  if (raw && typeof raw === "string" && raw.startsWith("validation.")) {
    return (
      <p
        className="text-destructive text-sm"
        data-slot="form-message"
        id={formMessageId}
        role="alert"
      >
        {t(raw)}
      </p>
    );
  }

  return <BaseFormMessage {...props} />;
}

interface ItemFormProps {
  availableTags: ParsedTag[];
  availableTricks: LinkedTrick[];
  defaultValues?: Partial<ItemFormValues>;
  formId: string;
  onCreateTag: (name: string) => Promise<TagId>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (data: ItemFormValues) => void;
  onToggleTag: (tagId: TagId) => void;
  onToggleTrick: (trickId: TrickId) => void;
  selectedTagIds: TagId[];
  selectedTrickIds: TrickId[];
  userBrands: string[];
  userLocations: string[];
}

function hasDetailsValues(
  values: Partial<ItemFormValues> | undefined
): boolean {
  if (!values) {
    return false;
  }
  return (
    (values.brand !== undefined && values.brand !== "") ||
    (values.creator !== undefined && values.creator !== "") ||
    (values.condition !== undefined && values.condition !== null) ||
    (values.location !== undefined && values.location !== "") ||
    (values.quantity !== undefined && values.quantity !== 1)
  );
}

function hasPurchaseValues(
  values: Partial<ItemFormValues> | undefined
): boolean {
  if (!values) {
    return false;
  }
  return (
    (values.purchaseDate !== undefined && values.purchaseDate !== "") ||
    (values.purchasePrice !== undefined && values.purchasePrice !== "")
  );
}

function hasReferenceValues(
  values: Partial<ItemFormValues> | undefined
): boolean {
  if (!values) {
    return false;
  }
  return values.url !== undefined && values.url !== "";
}

function ItemForm({
  defaultValues,
  onSubmit,
  formId,
  selectedTagIds,
  availableTags,
  onToggleTag,
  onCreateTag,
  selectedTrickIds,
  availableTricks,
  onToggleTrick,
  onDirtyChange,
  userBrands,
  userLocations,
}: ItemFormProps): React.ReactElement {
  const t = useTranslations("collect");
  const form = useForm<ItemFormInput, unknown, ItemFormValues>({
    defaultValues: {
      name: "",
      type: "prop",
      description: "",
      brand: "",
      creator: "",
      condition: null,
      location: "",
      quantity: 1,
      purchaseDate: "",
      purchasePrice: "",
      url: "",
      notes: "",
      ...defaultValues,
    },
    resolver: zodResolver(itemFormSchema),
  });

  const currentType = useWatch({ control: form.control, name: "type" });

  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const creatorLabel =
    currentType === "book"
      ? t("field.creatorLabelBook")
      : t("field.creatorLabelDefault");

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {/* Essentials */}
        <FormSection defaultOpen title={t("section.essentials")}>
          <div className="flex flex-col gap-4 px-2 pb-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("field.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.type")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ITEM_TYPES.map((itemType) => (
                        <SelectItem key={itemType} value={itemType}>
                          {t(TYPE_CONFIG[itemType].label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("field.descriptionPlaceholder")}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Details */}
        <FormSection
          defaultOpen={hasDetailsValues(defaultValues)}
          title={t("section.details")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.brand")}</FormLabel>
                  <FormControl>
                    <CategoryCombobox
                      onChange={field.onChange}
                      placeholder={t("field.brandPlaceholder")}
                      suggestions={SUGGESTED_BRANDS}
                      translationNamespace="collect"
                      userValues={userBrands}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="creator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{creatorLabel}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("field.creatorPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.condition")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value === NONE) {
                        field.onChange(null);
                        return;
                      }
                      if (isItemCondition(value)) {
                        field.onChange(value);
                        return;
                      }
                      // Unreachable: SelectItem values are constrained to
                      // NONE | ITEM_CONDITIONS. If this fires, SelectItem
                      // and ITEM_CONDITIONS have drifted.
                      if (process.env.NODE_ENV !== "production") {
                        console.warn(
                          "Condition Select received unknown value:",
                          value
                        );
                      }
                    }}
                    value={field.value ?? NONE}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("noneSelected")}</SelectItem>
                      {ITEM_CONDITIONS.map((cond) => (
                        <SelectItem key={cond} value={cond}>
                          {t(CONDITION_CONFIG[cond].label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.location")}</FormLabel>
                  <FormControl>
                    <CategoryCombobox
                      onChange={field.onChange}
                      placeholder={t("field.locationPlaceholder")}
                      suggestions={SUGGESTED_LOCATIONS}
                      translationNamespace="collect"
                      userValues={userLocations}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.quantity")}</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      max={9999}
                      min={0}
                      type="number"
                      {...field}
                      onChange={(event) => {
                        const val = event.target.valueAsNumber;
                        field.onChange(Number.isNaN(val) ? 0 : val);
                      }}
                      value={
                        typeof field.value === "number" &&
                        !Number.isNaN(field.value)
                          ? field.value
                          : 1
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Purchase Info */}
        <FormSection
          defaultOpen={hasPurchaseValues(defaultValues)}
          title={t("section.purchase")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.purchaseDate")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.purchasePrice")}</FormLabel>
                  <FormControl>
                    <PriceInput
                      onChange={field.onChange}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Reference */}
        <FormSection
          defaultOpen={hasReferenceValues(defaultValues)}
          title={t("section.reference")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.url")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("field.urlPlaceholder")}
                      type="url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Organization */}
        <FormSection
          defaultOpen={selectedTagIds.length > 0 || selectedTrickIds.length > 0}
          title={t("section.organization")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <fieldset
              aria-describedby="tags-limit-help"
              className="grid gap-2 border-none p-0"
            >
              <legend className="font-medium text-sm">{t("field.tags")}</legend>
              <TagPicker
                availableTags={availableTags}
                maxTags={MAX_TAGS_PER_ITEM}
                onCreateTag={onCreateTag}
                onToggleTag={onToggleTag}
                selectedTagIds={selectedTagIds}
                translationNamespace="collect"
              />
              <p className="text-muted-foreground text-xs" id="tags-limit-help">
                {selectedTagIds.length}/{MAX_TAGS_PER_ITEM}{" "}
                {t("field.tags").toLowerCase()}
              </p>
            </fieldset>

            <fieldset
              aria-describedby="tricks-limit-help"
              className="grid gap-2 border-none p-0"
            >
              <legend className="font-medium text-sm">
                {t("field.linkedTricks")}
              </legend>
              <TrickPicker
                availableTricks={availableTricks}
                maxTricks={MAX_TRICKS_PER_ITEM}
                onToggleTrick={onToggleTrick}
                selectedTrickIds={selectedTrickIds}
              />
              <p
                className="text-muted-foreground text-xs"
                id="tricks-limit-help"
              >
                {selectedTrickIds.length}/{MAX_TRICKS_PER_ITEM}{" "}
                {t("field.linkedTricks").toLowerCase()}
              </p>
            </fieldset>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("field.notesPlaceholder")}
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>
      </form>
    </Form>
  );
}

export type { ItemFormProps };
export { hasDetailsValues, hasPurchaseValues, hasReferenceValues, ItemForm };
