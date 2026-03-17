"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketingAuthButtons(): ReactElement {
  const { data: session, isPending } = authClient.useSession();
  const t = useTranslations("common");

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <Button asChild size="sm">
        <Link href="/dashboard">{t("goToDashboard")}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild size="sm" variant="ghost">
        <Link href="/auth/sign-in">{t("signIn")}</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/auth/sign-up">{t("getStarted")}</Link>
      </Button>
    </>
  );
}
