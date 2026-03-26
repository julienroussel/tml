"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TagId } from "@/db/types";
import {
  ANGLE_SENSITIVITIES,
  MAX_TAGS_PER_TRICK,
  PERFORMANCE_TYPES,
  STATUS_CONFIG,
  SUGGESTED_CATEGORIES,
  SUGGESTED_EFFECT_TYPES,
  TRICK_STATUSES,
} from "../constants";
import { type TrickFormValues, trickFormSchema } from "../schema";
import type { ParsedTag } from "../types";
import { CategoryCombobox } from "./category-combobox";
import { DurationInput } from "./duration-input";
import { FormSection } from "./form-section";
import { TagPicker } from "./tag-picker";
import { TrickDifficulty } from "./trick-difficulty";

/**
 * FormMessage wrapper that translates Zod validation keys (e.g. "validation.nameRequired")
 * via the repertoire i18n namespace so users see localized text instead of raw keys.
 */
function FormMessage(
  props: React.ComponentProps<typeof BaseFormMessage>
): React.ReactElement | null {
  const t = useTranslations("repertoire");
  const { error, formMessageId } = useFormField();
  const raw = error?.message;

  // BaseFormMessage ignores children when error is truthy (it reads
  // error.message directly). Render translated text ourselves so users
  // see localized messages instead of raw i18n keys.
  if (raw && typeof raw === "string" && raw.startsWith("validation.")) {
    return (
      <p
        className="text-destructive text-sm"
        data-slot="form-message"
        id={formMessageId}
      >
        {t(raw)}
      </p>
    );
  }

  return <BaseFormMessage {...props} />;
}

/** Sentinel value for nullable Select fields (Radix Select doesn't support empty string values). */
const NONE = "__none__";

interface TrickFormProps {
  availableTags: ParsedTag[];
  defaultValues?: Partial<TrickFormValues>;
  formId: string;
  onCreateTag: (name: string) => Promise<TagId>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (data: TrickFormValues) => void;
  onToggleTag: (tagId: TagId) => void;
  selectedTagIds: TagId[];
  userCategories: string[];
  userEffectTypes: string[];
}

function hasPerformanceValues(
  values: Partial<TrickFormValues> | undefined
): boolean {
  if (!values) {
    return false;
  }
  return (
    values.difficulty !== null &&
    values.difficulty !== undefined &&
    values.status !== undefined &&
    values.status !== "new" &&
    values.duration !== null &&
    values.duration !== undefined &&
    values.performanceType !== null &&
    values.performanceType !== undefined &&
    values.angleSensitivity !== null &&
    values.angleSensitivity !== undefined
  );
}

function hasShowSetupValues(
  values: Partial<TrickFormValues> | undefined
): boolean {
  if (!values) {
    return false;
  }
  return (
    (values.props !== undefined && values.props !== "") ||
    (values.music !== undefined && values.music !== "") ||
    (values.languages !== undefined && values.languages.length > 0) ||
    values.isCameraFriendly === true ||
    values.isSilent === true
  );
}

function hasReferenceValues(
  values: Partial<TrickFormValues> | undefined
): boolean {
  if (!values) {
    return false;
  }
  return (
    (values.source !== undefined && values.source !== "") ||
    (values.videoUrl !== undefined && values.videoUrl !== "")
  );
}

function TrickForm({
  defaultValues,
  onSubmit,
  formId,
  selectedTagIds,
  availableTags,
  onToggleTag,
  onCreateTag,
  onDirtyChange,
  userCategories,
  userEffectTypes,
}: TrickFormProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const form = useForm<TrickFormValues>({
    defaultValues: {
      name: "",
      description: "",
      category: "",
      effectType: "",
      difficulty: null,
      status: "new",
      duration: null,
      performanceType: null,
      angleSensitivity: null,
      props: "",
      music: "",
      languages: [],
      isCameraFriendly: null,
      isSilent: null,
      source: "",
      videoUrl: "",
      notes: "",
      ...defaultValues,
    },
    // TODO: remove cast when @hookform/resolvers supports Zod 4 — tracked in review follow-ups
    resolver: zodResolver(
      trickFormSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<TrickFormValues>,
  });

  const languages =
    useWatch({ control: form.control, name: "languages" }) ?? [];

  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {/* The Basics */}
        <FormSection defaultOpen title={t("section.basics")}>
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

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.category")}</FormLabel>
                  <FormControl>
                    <CategoryCombobox
                      onChange={field.onChange}
                      placeholder={t("field.categoryPlaceholder")}
                      suggestions={SUGGESTED_CATEGORIES}
                      userValues={userCategories}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.effectType")}</FormLabel>
                  <FormControl>
                    <CategoryCombobox
                      onChange={field.onChange}
                      placeholder={t("field.effectTypePlaceholder")}
                      suggestions={SUGGESTED_EFFECT_TYPES}
                      userValues={userEffectTypes}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Performance */}
        <FormSection
          defaultOpen={hasPerformanceValues(defaultValues)}
          title={t("section.performance")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.difficulty")}</FormLabel>
                  <FormControl>
                    <TrickDifficulty
                      onChange={field.onChange}
                      value={field.value ?? null}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.status")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRICK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(STATUS_CONFIG[s].label)}
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
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.duration")}</FormLabel>
                  <FormControl>
                    <DurationInput
                      onChange={field.onChange}
                      value={field.value ?? null}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="performanceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.performanceType")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === NONE ? null : value);
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
                      {PERFORMANCE_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt}>
                          {t(`performanceType.${pt}`)}
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
              name="angleSensitivity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.angleSensitivity")}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === NONE ? null : value);
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
                      {ANGLE_SENSITIVITIES.map((as_) => (
                        <SelectItem key={as_} value={as_}>
                          {t(`angleSensitivity.${as_}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Show Setup */}
        <FormSection
          defaultOpen={hasShowSetupValues(defaultValues)}
          title={t("section.showSetup")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <FormField
              control={form.control}
              name="props"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.props")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("field.propsPlaceholder")}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="music"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.music")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("field.musicPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LanguagesField
              onChange={(languages) =>
                form.setValue("languages", languages, { shouldDirty: true })
              }
              value={languages}
            />

            <FormField
              control={form.control}
              name="isCameraFriendly"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="flex-1">
                    {t("field.isCameraFriendly")}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isSilent"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="flex-1">
                    {t("field.isSilent")}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                      }}
                    />
                  </FormControl>
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
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.source")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("field.sourcePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="videoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("field.videoUrl")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("field.videoUrlPlaceholder")}
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
          defaultOpen={selectedTagIds.length > 0}
          title={t("section.organization")}
        >
          <div className="flex flex-col gap-4 px-2 pb-2">
            <fieldset className="grid gap-2 border-none p-0">
              <legend className="font-medium text-sm">{t("field.tags")}</legend>
              <TagPicker
                availableTags={availableTags}
                maxTags={MAX_TAGS_PER_TRICK}
                onCreateTag={onCreateTag}
                onToggleTag={onToggleTag}
                selectedTagIds={selectedTagIds}
              />
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

// ---------------------------------------------------------------------------
// Languages field (simple chip input, not a FormField)
// ---------------------------------------------------------------------------

interface LanguagesFieldProps {
  onChange: (languages: string[]) => void;
  value: string[];
}

function LanguagesField({
  value,
  onChange,
}: LanguagesFieldProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const [input, setInput] = useState("");

  function addLanguage(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return;
    }
    // Avoid duplicates (case-insensitive)
    if (value.some((lang) => lang.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      return;
    }
    if (value.length >= 10) {
      return;
    }
    onChange([...value, trimmed]);
    setInput("");
  }

  function removeLanguage(index: number): void {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addLanguage(input);
    }
    if (event.key === "Backspace" && input === "" && value.length > 0) {
      removeLanguage(value.length - 1);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="font-medium text-sm" htmlFor="languages-input">
        {t("field.languages")}
      </label>
      <Input
        aria-describedby="languages-input-hint"
        id="languages-input"
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("field.languagesPlaceholder")}
        value={input}
      />
      <span className="sr-only" id="languages-input-hint">
        {t("field.languagesHint")}
      </span>
      {value.length > 0 && (
        <ul
          aria-label={t("field.languages")}
          className="flex flex-wrap gap-1.5"
        >
          {value.map((lang, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: language names can be duplicated — index is needed for uniqueness
            <li key={`${lang}-${index}`}>
              <Badge className="gap-1 py-1 pr-1 pl-2" variant="secondary">
                <span>{lang}</span>
                <button
                  aria-label={t("removeLanguage", { language: lang })}
                  className="relative flex items-center justify-center rounded-sm p-1.5 before:absolute before:inset-[-8px] before:content-[''] hover:bg-accent"
                  onClick={() => removeLanguage(index)}
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

export type { TrickFormProps };
export { TrickForm };
