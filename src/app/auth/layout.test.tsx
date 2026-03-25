import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "./layout";

const mockGetLocale = vi.fn<() => Promise<string>>().mockResolvedValue("en");

vi.mock("next-intl/server", () => {
  const makeT = (namespace?: string) => {
    const t = (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      if (values) {
        const parts = Object.entries(values).map(
          ([k, v]) => `${k}: ${String(v)}`
        );
        return `${fullKey} (${parts.join(", ")})`;
      }
      return fullKey;
    };
    return Object.assign(t, { rich: t, raw: t, markup: t });
  };

  return {
    setRequestLocale: vi.fn(),
    getTranslations: (
      namespaceOrOpts?: string | { locale?: string; namespace?: string }
    ) => {
      const namespace =
        typeof namespaceOrOpts === "string"
          ? namespaceOrOpts
          : namespaceOrOpts?.namespace;
      return Promise.resolve(makeT(namespace));
    },
    getLocale: (...args: unknown[]) => mockGetLocale(...(args as [])),
    getMessages: () => Promise.resolve({}),
  };
});

const providersPropsSpy = vi.fn();
vi.mock("@/components/providers", () => ({
  Providers: (props: Record<string, unknown>) => {
    providersPropsSpy(props);
    return <>{props.children}</>;
  },
}));

describe("AuthLayout", () => {
  it("renders children inside Providers", async () => {
    render(await AuthLayout({ children: <div>auth content</div> }));

    expect(screen.getByText("auth content")).toBeInTheDocument();
  });

  it("renders skip-to-content link with translated text", async () => {
    render(await AuthLayout({ children: <div>content</div> }));

    const skipLink = screen.getByText("common.skipToContent");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("does not wrap children in a main element (auth pages provide their own)", async () => {
    render(
      await AuthLayout({
        children: <main id="main-content">content</main>,
      })
    );

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
  });

  it("reads locale from getLocale and passes it to Providers", async () => {
    mockGetLocale.mockResolvedValueOnce("fr");
    providersPropsSpy.mockClear();

    render(await AuthLayout({ children: <div>content</div> }));

    expect(providersPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "fr",
        messages: expect.any(Object),
      })
    );
  });

  it("falls back to defaultLocale when getLocale returns unsupported value", async () => {
    mockGetLocale.mockResolvedValueOnce("zz");
    providersPropsSpy.mockClear();

    render(await AuthLayout({ children: <div>content</div> }));

    expect(providersPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
      })
    );
  });
});
