import { AuthView } from "@neondatabase/auth/react";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { LocaleToggle } from "@/components/locale-toggle";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamicParams = false;

export function generateStaticParams(): { path: string }[] {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}): Promise<ReactElement> {
  const { path } = await params;
  const t = await getTranslations("common");

  return (
    <main
      className="container mx-auto flex grow flex-col items-center self-center p-4 md:p-6"
      id="main-content"
    >
      <nav
        aria-label={t("pageSettings")}
        className="ml-auto flex items-center gap-2"
      >
        <LocaleToggle />
        <ThemeToggle />
      </nav>
      <div className="flex grow flex-col items-center justify-center gap-6">
        <Logo className="flex items-center" height={56} width={168} />
        <AuthView callbackURL="/dashboard" path={path} />
      </div>
    </main>
  );
}
