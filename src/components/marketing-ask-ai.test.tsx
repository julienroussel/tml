import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslations } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics";
import { MarketingAskAi } from "./marketing-ask-ai";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

type TranslateFn = (key: string) => string;

const defaultT: TranslateFn = (key: string) => `footer.askAi.${key}`;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelPattern(key: string): RegExp {
  return new RegExp(escapeRegex(`footer.askAi.${key}`));
}

function setTranslator(t: TranslateFn): void {
  vi.mocked(useTranslations).mockReturnValue(
    t as unknown as ReturnType<typeof useTranslations>
  );
}

describe("MarketingAskAi", () => {
  beforeEach(() => {
    setTranslator(defaultT);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("scopes translations to the footer.askAi namespace", () => {
    render(<MarketingAskAi />);
    expect(useTranslations).toHaveBeenCalledWith("footer.askAi");
  });

  it("renders one link per provider with the correct hostname and ?q= prompt", () => {
    render(<MarketingAskAi />);

    const expected: Array<{ key: string; hostname: string; path: string }> = [
      { key: "chatGpt", hostname: "chatgpt.com", path: "/" },
      { key: "claude", hostname: "claude.ai", path: "/new" },
      {
        key: "perplexity",
        hostname: "www.perplexity.ai",
        path: "/search/new",
      },
    ];

    for (const { key, hostname, path } of expected) {
      const link = screen.getByRole("link", { name: labelPattern(key) });
      const href = link.getAttribute("href");
      expect(href, `href for ${key}`).toBeTruthy();
      const url = new URL(href ?? "");
      expect(url.hostname).toBe(hostname);
      expect(url.pathname).toBe(path);
      expect(url.searchParams.get("q")).toBe("footer.askAi.prompt");
    }
  });

  it("opens each link in a new tab with safe rel attributes", () => {
    render(<MarketingAskAi />);

    for (const key of ["chatGpt", "claude", "perplexity"]) {
      const link = screen.getByRole("link", { name: labelPattern(key) });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("composes the link's accessible name from provider label and 'opens in new tab'", () => {
    render(<MarketingAskAi />);

    for (const key of ["chatGpt", "claude", "perplexity"]) {
      const pattern = new RegExp(
        `${escapeRegex(`footer.askAi.${key}`)}.*${escapeRegex("footer.askAi.opensInNewTab")}`
      );
      expect(screen.getByRole("link", { name: pattern })).toBeInTheDocument();
    }
  });

  it("URL-encodes special characters in the prompt within the href", () => {
    setTranslator((key) =>
      key === "prompt" ? "hello & world?" : `footer.askAi.${key}`
    );

    render(<MarketingAskAi />);

    const link = screen.getByRole("link", { name: labelPattern("chatGpt") });
    const href = link.getAttribute("href") ?? "";

    expect(href).toContain("hello%20%26%20world%3F");
    expect(href).not.toContain("hello & world?");
  });

  it("fires marketing_ask_ai_clicked with the right provider on click", async () => {
    const user = userEvent.setup();
    render(<MarketingAskAi />);

    const cases: Array<{ key: string; provider: string }> = [
      { key: "chatGpt", provider: "chatgpt" },
      { key: "claude", provider: "claude" },
      { key: "perplexity", provider: "perplexity" },
    ];

    for (const { key, provider } of cases) {
      await user.click(screen.getByRole("link", { name: labelPattern(key) }));
      expect(trackEvent).toHaveBeenCalledWith("marketing_ask_ai_clicked", {
        provider,
      });
    }
    expect(trackEvent).toHaveBeenCalledTimes(3);
  });

  it("renders the link group as a list of three items labelled by the section heading", () => {
    render(<MarketingAskAi />);

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "footer.askAi.groupLabel",
      })
    ).toBeInTheDocument();
  });

  it("renders the visible third-party disclosure", () => {
    render(<MarketingAskAi />);

    expect(screen.getByText("footer.askAi.disclosure")).toBeInTheDocument();
  });

  it("renders a decorative icon inside each provider link", () => {
    render(<MarketingAskAi />);

    for (const key of ["chatGpt", "claude", "perplexity"]) {
      const link = screen.getByRole("link", { name: labelPattern(key) });
      const svg = link.querySelector("svg");
      expect(svg, `icon for ${key}`).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
