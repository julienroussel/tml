"use client";

import { useTranslations } from "next-intl";
import type { ComponentType, ReactElement } from "react";
import {
  ClaudeIcon,
  type IconProps,
  OpenAiIcon,
  PerplexityIcon,
} from "@/components/ai-provider-icons";
import { type MarketingAiProviderId, trackEvent } from "@/lib/analytics";

type Provider = {
  id: MarketingAiProviderId;
  labelKey: "chatGpt" | "claude" | "perplexity";
  Icon: ComponentType<IconProps>;
  urlFor: (encodedPrompt: string) => string;
};

const PROVIDERS: readonly Provider[] = [
  {
    id: "chatgpt",
    labelKey: "chatGpt",
    Icon: OpenAiIcon,
    urlFor: (q) => `https://chatgpt.com/?q=${q}`,
  },
  {
    id: "claude",
    labelKey: "claude",
    Icon: ClaudeIcon,
    urlFor: (q) => `https://claude.ai/new?q=${q}`,
  },
  {
    id: "perplexity",
    labelKey: "perplexity",
    Icon: PerplexityIcon,
    urlFor: (q) => `https://www.perplexity.ai/search/new?q=${q}`,
  },
];

export function MarketingAskAi(): ReactElement {
  const t = useTranslations("footer.askAi");
  const encodedPrompt = encodeURIComponent(t("prompt"));

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h2 className="sr-only">{t("groupLabel")}</h2>
      <p className="text-muted-foreground text-sm">{t("heading")}</p>
      <ul
        className="m-0 flex list-none flex-wrap items-center justify-center gap-2 p-0"
        // biome-ignore lint/a11y/noRedundantRoles: Safari + VoiceOver strip the implicit list role when list-style: none is applied; explicit role="list" restores it.
        role="list"
      >
        {PROVIDERS.map((provider) => (
          <li key={provider.id}>
            <a
              aria-label={`${t(provider.labelKey)} ${t("opensInNewTab")}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background py-1.5 pr-4 pl-3 text-foreground text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 motion-safe:transition-colors"
              href={provider.urlFor(encodedPrompt)}
              onClick={() =>
                trackEvent("marketing_ask_ai_clicked", {
                  provider: provider.id,
                })
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              <provider.Icon className="h-4 w-4 shrink-0" />
              {t(provider.labelKey)}
            </a>
          </li>
        ))}
      </ul>
      <p className="max-w-md text-muted-foreground text-xs">
        {t("disclosure")}
      </p>
    </div>
  );
}
