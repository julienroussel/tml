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

const FAQ_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  setRequestLocale(isLocale(rawLocale) ? rawLocale : defaultLocale);

  return {
    title: "FAQ",
    description:
      "Frequently asked questions about The Magic Lab — a free workspace for magicians.",
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/faq`])),
    },
  };
}

export default async function FaqPage({
  params,
}: Readonly<LocaleParams>): Promise<ReactElement> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "faq" });

  const faqItems = FAQ_KEYS.map((n) => ({
    question: t(`q${n}`),
    answer: t(`a${n}`),
  }));

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="mb-8 font-semibold text-3xl tracking-tight">
        {t("title")}
      </h1>
      <div className="flex flex-col gap-8">
        {faqItems.map((item) => (
          <div key={item.question}>
            <h2 className="mb-2 font-semibold text-lg">{item.question}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {item.answer}
            </p>
          </div>
        ))}
      </div>

      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data from static object — no user input
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
        type="application/ld+json"
      />
    </section>
  );
}
