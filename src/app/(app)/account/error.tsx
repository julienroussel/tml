"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error(error);
    mainRef.current?.focus();
  }, [error]);

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
      ref={mainRef}
      tabIndex={-1}
    >
      <div role="alert">
        <h1 className="font-semibold text-xl">{t("somethingWrong")}</h1>
        <p className="text-muted-foreground">{t("unexpectedError")}</p>
      </div>
      <div className="flex gap-2">
        <Button className="min-h-11" onClick={reset} type="button">
          {t("tryAgain")}
        </Button>
        <Button asChild className="min-h-11" variant="outline">
          <Link href="/dashboard">{tCommon("goToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
