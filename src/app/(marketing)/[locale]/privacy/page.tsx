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
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <div className="text-muted-foreground flex flex-col gap-6 leading-relaxed">
        <p>{t("intro")}</p>
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            {t("dataCollectTitle")}
          </h2>
          <p>{t("dataCollectDesc")}</p>
        </div>
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            {t("dataUseTitle")}
          </h2>
          <p>{t("dataUseDesc")}</p>
        </div>
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            {t("dataStorageTitle")}
          </h2>
          <p>{t("dataStorageDesc")}</p>
        </div>
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            {t("rightsTitle")}
          </h2>
          <p>{t("rightsDesc")}</p>
        </div>
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            {t("analyticsTitle")}
          </h2>
          <p>{t("analyticsDesc")}</p>
        </div>
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            {t("thirdPartyToolsTitle")}
          </h2>
          <p>{t("thirdPartyToolsDesc")}</p>
        </div>
      </div>
    </section>
  );
}
