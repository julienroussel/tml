import { Code, Dumbbell, Globe, Shield, WifiOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMainModules } from "@/lib/modules";

export default async function Home(): Promise<ReactElement> {
  const t = await getTranslations("marketing");
  const modules = getMainModules();

  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="flex flex-col items-center justify-center gap-8 px-6 py-24 text-center"
      >
        <div className="flex flex-col items-center gap-3">
          <h1 className="sr-only" id="hero-title">
            The Magic Lab
          </h1>
          <Image
            alt=""
            className="block dark:hidden"
            height={100}
            priority
            src="/logo-light.svg"
            width={300}
          />
          <Image
            alt=""
            className="hidden dark:block"
            height={100}
            priority
            src="/logo-dark.svg"
            width={300}
          />
        </div>
        <p className="max-w-lg text-muted-foreground text-xl leading-relaxed">
          {t("tagline")}
        </p>
        <p className="max-w-md text-muted-foreground leading-relaxed">
          {t("description")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full" size="lg">
            <Link href="/auth/sign-up">{t("getStarted")}</Link>
          </Button>
          <Button asChild className="rounded-full" size="lg" variant="outline">
            <a
              href="https://github.com/julienroussel/tml"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("viewOnGitHub")}
            </a>
          </Button>
        </div>
      </section>

      {/* Trust Bar */}
      <section
        aria-label="Key benefits"
        className="border-y bg-muted/30 px-6 py-8"
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Shield className="size-4" />
            <span>{t("freeForever")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Code className="size-4" />
            <span>{t("openSource")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <WifiOff className="size-4" />
            <span>{t("worksOffline")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Globe className="size-4" />
            <span>{t("builtByMagician")}</span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section aria-labelledby="how-it-works" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2
            className="mb-12 text-center font-semibold text-2xl tracking-tight"
            id="how-it-works"
          >
            {t("howItWorks")}
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                1
              </div>
              <h3 className="font-semibold">{t("step1Title")}</h3>
              <p className="text-muted-foreground text-sm">{t("step1Desc")}</p>
            </div>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                2
              </div>
              <h3 className="font-semibold">{t("step2Title")}</h3>
              <p className="text-muted-foreground text-sm">{t("step2Desc")}</p>
            </div>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                3
              </div>
              <h3 className="font-semibold">{t("step3Title")}</h3>
              <p className="text-muted-foreground text-sm">{t("step3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section
        aria-labelledby="features"
        className="border-t bg-muted/30 px-6 py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            className="mb-12 text-center font-semibold text-2xl tracking-tight"
            id="features"
          >
            {t("features")}
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  className="group flex flex-col gap-3 rounded-xl p-4 transition-colors hover:bg-background"
                  href={`/${mod.slug}`}
                  key={mod.slug}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-6 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{mod.label}</h3>
                      <Badge variant="secondary">{t("comingSoon")}</Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {mod.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section aria-labelledby="open-source" className="px-6 py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h2
            className="font-semibold text-2xl tracking-tight"
            id="open-source"
          >
            {t("openSourceTitle")}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("openSourceDesc")}
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="outline">GPL-3.0</Badge>
            <Button asChild size="sm" variant="outline">
              <a
                href="https://github.com/julienroussel/tml"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Code className="mr-2 size-4" />
                {t("viewOnGitHub")}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        aria-label="Call to action"
        className="border-t bg-muted/30 px-6 py-24"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <Dumbbell className="size-10 text-muted-foreground" />
          <h2 className="font-semibold text-2xl tracking-tight">
            {t("ctaTitle")}
          </h2>
          <p className="text-muted-foreground">{t("ctaDesc")}</p>
          <Button asChild className="rounded-full" size="lg">
            <Link href="/auth/sign-up">{t("getStarted")}</Link>
          </Button>
        </div>
      </section>

      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data from static object — no user input
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "The Magic Lab",
            description:
              "A free, open-source workspace for magicians to organize their repertoire, plan routines, track practice sessions, and refine performances.",
            applicationCategory: "UtilityApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            url: "https://themagiclab.app",
          }),
        }}
        type="application/ld+json"
      />
    </>
  );
}
