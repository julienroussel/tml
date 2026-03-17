"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const t = useTranslations("errors");
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error(error);
    mainRef.current?.focus();
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      ref={mainRef}
      tabIndex={-1}
    >
      <div role="alert">
        <h1 className="font-semibold text-xl">{t("authError")}</h1>
        <p className="text-muted-foreground">{t("authErrorDesc")}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} type="button">
          {t("tryAgain")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t("goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
