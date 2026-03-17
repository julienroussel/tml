"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
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
    document.title = "Error | The Magic Lab";
    return () => {
      document.title = previousTitle;
    };
  }, []);

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
