import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

// Re-mock NextIntlClientProvider as a vi.fn() so locale detection tests
// can assert on the props passed to the provider. The global mock in
// vitest.setup.ts uses a plain function — this override adds spy
// capabilities while preserving the same render behaviour for all hooks.
const { providerMock } = vi.hoisted(() => ({
  providerMock: vi.fn(({ children }: { children: unknown }) => children),
}));
vi.mock("next-intl", () => {
  const useTranslations = (namespace?: string) => {
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
    useTranslations,
    useLocale: () => "en",
    useMessages: () => ({}),
    NextIntlClientProvider: providerMock,
  };
});

describe("ErrorPage", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the error heading", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });

  it("renders the retry button", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "errors.tryAgain" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    await userEvent.click(
      screen.getByRole("button", { name: "errors.tryAgain" })
    );
    expect(reset).toHaveBeenCalledOnce();
  });

  it("calls reset when retry button is activated via keyboard (Enter)", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    const button = screen.getByRole("button", { name: "errors.tryAgain" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(reset).toHaveBeenCalledOnce();
  });

  it("calls reset when retry button is activated via keyboard (Space)", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    const button = screen.getByRole("button", { name: "errors.tryAgain" });
    button.focus();
    await userEvent.keyboard(" ");
    expect(reset).toHaveBeenCalledOnce();
  });

  it("logs the error to console", () => {
    const error = new Error("test error");
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it("sets document.title on mount", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(document.title).toBe("errors.pageTitle");
  });

  it("restores document.title on unmount", () => {
    document.title = "Previous Title";
    const { unmount } = render(
      <ErrorPage error={new Error("test")} reset={vi.fn()} />
    );
    expect(document.title).toBe("errors.pageTitle");
    unmount();
    expect(document.title).toBe("Previous Title");
  });

  it("moves focus to the main element on mount", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(main);
  });

  it("renders correctly when error has a digest", () => {
    const error = Object.assign(new Error("test"), {
      digest: "NEXT_DIGEST_abc123",
    });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "errors.tryAgain" })
    ).toBeInTheDocument();
  });

  describe("fallback when messages are unavailable", () => {
    let errorMessagesRef: typeof import("@/i18n/messages/errors-only").errorMessages;
    let originalEn: (typeof errorMessagesRef)["en"];

    beforeEach(async () => {
      const mod = await import("@/i18n/messages/errors-only");
      errorMessagesRef = mod.errorMessages;
      originalEn = errorMessagesRef.en;
      // @ts-expect-error — intentionally setting to undefined for runtime safety test
      errorMessagesRef.en = undefined;
      providerMock.mockClear();
    });

    afterEach(() => {
      errorMessagesRef.en = originalEn;
    });

    it("renders hardcoded English strings when errorMessages returns undefined", () => {
      render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);

      expect(
        screen.getByRole("heading", { name: "Something went wrong" })
      ).toBeInTheDocument();
      expect(
        screen.getByText("An unexpected error occurred.")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Try again" })
      ).toBeInTheDocument();
      expect(document.title).toBe("Error | The Magic Lab");
    });

    it("does not render NextIntlClientProvider in fallback mode", () => {
      render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);

      expect(providerMock).not.toHaveBeenCalled();
    });

    it("calls reset via fallback retry button", async () => {
      const reset = vi.fn();
      render(<ErrorPage error={new Error("test")} reset={reset} />);
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(reset).toHaveBeenCalledOnce();
    });

    it("falls back to English when a non-default locale has no messages", () => {
      // Restore en so only fr is missing
      errorMessagesRef.en = originalEn;
      const originalFr = errorMessagesRef.fr;
      // @ts-expect-error — intentionally setting to undefined for runtime safety test
      errorMessagesRef.fr = undefined;
      document.documentElement.lang = "fr";

      try {
        render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);

        expect(
          screen.getByRole("heading", { name: "Something went wrong" })
        ).toBeInTheDocument();
        expect(providerMock).not.toHaveBeenCalled();
      } finally {
        errorMessagesRef.fr = originalFr;
        document.documentElement.lang = "";
      }
    });
  });

  describe("locale detection", () => {
    afterEach(() => {
      document.documentElement.lang = "";
    });

    it("detects a valid locale from document.documentElement.lang", () => {
      document.documentElement.lang = "fr";
      render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);

      expect(providerMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ locale: "fr" }),
        undefined
      );
      expect(
        screen.getByRole("heading", { name: "errors.somethingWrong" })
      ).toBeInTheDocument();
    });

    it("falls back to default locale for an invalid lang attribute", () => {
      document.documentElement.lang = "xx";
      render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);

      expect(providerMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ locale: "en" }),
        undefined
      );
      expect(
        screen.getByRole("heading", { name: "errors.somethingWrong" })
      ).toBeInTheDocument();
    });
  });
});
