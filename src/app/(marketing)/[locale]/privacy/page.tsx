import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactElement } from "react";
import {
  defaultLocale,
  isLocale,
  type Locale,
  type LocaleParams,
  locales,
} from "@/i18n/config";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  setRequestLocale(isLocale(rawLocale) ? rawLocale : defaultLocale);

  return {
    title: "Privacy Policy",
    description: "Privacy policy for The Magic Lab.",
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/privacy`])),
    },
  };
}

export default async function PrivacyPage({
  params,
}: Readonly<LocaleParams>): Promise<ReactElement> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "privacy" });

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="mb-8 font-semibold text-3xl tracking-tight">
        {t("title")}
      </h1>
      <div className="flex flex-col gap-6 text-muted-foreground leading-relaxed">
        <p>{t("intro")}</p>
        <div>
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            {t("dataCollectTitle")}
          </h2>
          <p>{t("dataCollectDesc")}</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            {t("dataUseTitle")}
          </h2>
          <p>{t("dataUseDesc")}</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            {t("dataStorageTitle")}
          </h2>
          <p>{t("dataStorageDesc")}</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            {t("rightsTitle")}
          </h2>
          <p>{t("rightsDesc")}</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-foreground text-lg">
            {t("analyticsTitle")}
          </h2>
          <p>{t("analyticsDesc")}</p>
        </div>
      </div>
    </section>
  );
}
