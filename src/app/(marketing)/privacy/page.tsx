import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for The Magic Lab.",
};

export default async function PrivacyPage(): Promise<ReactElement> {
  const t = await getTranslations("privacy");

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
