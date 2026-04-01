"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { errorMessages } from "@/i18n/messages/errors-only";

const FALLBACK = {
  pageTitle: "Error | The Magic Lab",
  somethingWrong: "Something went wrong",
  unexpectedError: "An unexpected error occurred.",
  tryAgain: "Try again",
} as const;

interface ErrorDisplayProps {
  buttonLabel: string;
  description: string;
  error: Error & { digest?: string };
  heading: string;
  pageTitle: string;
  reset: () => void;
}

function ErrorDisplay({
  error,
  reset,
  pageTitle,
  heading,
  description,
  buttonLabel,
}: ErrorDisplayProps): ReactElement {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    console.error(error);
    mainRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = pageTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [pageTitle]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
    >
      <div role="alert">
        <h1 className="font-semibold text-xl">{heading}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Button className="min-h-11" onClick={reset} type="button">
        {buttonLabel}
      </Button>
    </main>
  );
}

function ErrorContent({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const t = useTranslations("errors");

  return (
    <ErrorDisplay
      buttonLabel={t("tryAgain")}
      description={t("unexpectedError")}
      error={error}
      heading={t("somethingWrong")}
      pageTitle={t("pageTitle")}
      reset={reset}
    />
  );
}

/**
 * Root error boundary. Provides its own NextIntlClientProvider since
 * the root layout does not include one — intl providers live in the
 * route-group sub-layouts which may have been the source of the error.
 *
 * Falls back to hardcoded English strings if the locale messages fail
 * to resolve (e.g., during early hydration errors or code-split races).
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const [locale] = useState<Locale>(() => {
    if (typeof document === "undefined") {
      return defaultLocale;
    }
    const lang = document.documentElement.lang;
    return isLocale(lang) ? lang : defaultLocale;
  });

  const messages = errorMessages[locale];

  if (!messages) {
    return (
      <ErrorDisplay
        buttonLabel={FALLBACK.tryAgain}
        description={FALLBACK.unexpectedError}
        error={error}
        heading={FALLBACK.somethingWrong}
        pageTitle={FALLBACK.pageTitle}
        reset={reset}
      />
    );
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ErrorContent error={error} reset={reset} />
    </NextIntlClientProvider>
  );
}
