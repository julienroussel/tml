"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { errorMessages } from "@/i18n/messages/errors-only";

function ErrorContent({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const t = useTranslations("errors");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    console.error(error);
    mainRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("pageTitle");
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
    >
      <div role="alert">
        <h1 className="font-semibold text-xl">{t("somethingWrong")}</h1>
        <p className="text-muted-foreground">{t("unexpectedError")}</p>
      </div>
      <Button onClick={reset} type="button">
        {t("tryAgain")}
      </Button>
    </main>
  );
}

/**
 * Root error boundary. Provides its own NextIntlClientProvider since
 * the root layout does not include one — intl providers live in the
 * route-group sub-layouts which may have been the source of the error.
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

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={errorMessages[locale]}
      timeZone="UTC"
    >
      <ErrorContent error={error} reset={reset} />
    </NextIntlClientProvider>
  );
}
