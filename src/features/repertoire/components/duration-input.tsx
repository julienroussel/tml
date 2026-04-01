"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface DurationInputProps {
  onChange: (value: number | null) => void;
  placeholder?: string;
  value: number | null;
}

export function splitSeconds(totalSeconds: number | null): {
  minutes: string;
  seconds: string;
} {
  if (totalSeconds === null || totalSeconds < 0) {
    return { minutes: "", seconds: "" };
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    minutes: minutes > 0 ? String(minutes) : "",
    seconds: seconds > 0 || minutes > 0 ? String(seconds) : "",
  };
}

export function combineToSeconds(
  minutesStr: string,
  secondsStr: string
): number | null {
  const minutes = minutesStr === "" ? 0 : Number.parseInt(minutesStr, 10);
  const seconds = secondsStr === "" ? 0 : Number.parseInt(secondsStr, 10);

  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }
  if (minutesStr === "" && secondsStr === "") {
    return null;
  }

  return minutes * 60 + seconds;
}

export function DurationInput({
  value,
  onChange,
  placeholder,
}: DurationInputProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const derived = splitSeconds(value);
  const [minutesStr, setMinutesStr] = useState(derived.minutes);
  const [secondsStr, setSecondsStr] = useState(derived.seconds);

  // Resync local state when the prop changes externally (e.g. form reset).
  // We read current local state via refs to avoid re-running the effect when
  // the user is typing (we only want to fire when the parent prop changes).
  const minutesRef = useRef(minutesStr);
  minutesRef.current = minutesStr;
  const secondsRef = useRef(secondsStr);
  secondsRef.current = secondsStr;

  useEffect(() => {
    const localValue = combineToSeconds(minutesRef.current, secondsRef.current);
    if (localValue !== value) {
      const propDerived = splitSeconds(value);
      setMinutesStr(propDerived.minutes);
      setSecondsStr(propDerived.seconds);
    }
  }, [value]);

  function handleMinutesChange(event: ChangeEvent<HTMLInputElement>): void {
    setMinutesStr(event.target.value);
  }

  function handleSecondsChange(event: ChangeEvent<HTMLInputElement>): void {
    setSecondsStr(event.target.value);
  }

  function handleMinutesBlur(): void {
    const clamped =
      minutesStr === ""
        ? ""
        : String(
            Math.min(Math.max(0, Number.parseInt(minutesStr, 10) || 0), 120)
          );
    setMinutesStr(clamped);
    onChange(combineToSeconds(clamped, secondsStr));
  }

  function handleSecondsBlur(): void {
    const clamped =
      secondsStr === ""
        ? ""
        : String(
            Math.min(Math.max(0, Number.parseInt(secondsStr, 10) || 0), 59)
          );
    setSecondsStr(clamped);
    onChange(combineToSeconds(minutesStr, clamped));
  }

  return (
    <div className="flex max-w-40 items-center gap-1">
      <Input
        aria-label={t("field.durationMinutes")}
        className="w-16 text-center tabular-nums"
        max={120}
        min={0}
        onBlur={handleMinutesBlur}
        onChange={handleMinutesChange}
        placeholder={placeholder ?? "0"}
        type="number"
        value={minutesStr}
      />
      <span
        aria-hidden="true"
        className="font-medium text-muted-foreground text-sm"
      >
        :
      </span>
      <Input
        aria-label={t("field.durationSeconds")}
        className="w-16 text-center tabular-nums"
        max={59}
        min={0}
        onBlur={handleSecondsBlur}
        onChange={handleSecondsChange}
        placeholder="00"
        type="number"
        value={secondsStr}
      />
    </div>
  );
}
