"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

interface PriceInputProps
  extends Omit<
    React.ComponentProps<typeof Input>,
    "inputMode" | "onChange" | "placeholder" | "value"
  > {
  onChange: (value: string) => void;
  value: string;
}

/**
 * Text input for purchase price with mobile-friendly decimal keyboard.
 *
 * Uses `inputMode="decimal"` to show a numeric keypad on mobile devices
 * while keeping the underlying input as text to preserve formatting
 * (e.g. leading zeros, decimal places).
 *
 * Forwards `id`, `aria-describedby`, and `aria-invalid` from FormControl
 * so the label association is preserved.
 */
export function PriceInput({
  value,
  onChange,
  ...rest
}: PriceInputProps): React.ReactElement {
  const t = useTranslations("collect");

  return (
    <Input
      inputMode="decimal"
      onChange={(event) => onChange(event.target.value)}
      placeholder={t("field.pricePlaceholder")}
      value={value}
      {...rest}
    />
  );
}
