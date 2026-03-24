import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

const neonAuthSpy = vi.fn();
vi.mock("@neondatabase/auth/react", () => ({
  NeonAuthUIProvider: (props: Record<string, unknown>) => {
    neonAuthSpy(props);
    return <>{props.children as ReactNode}</>;
  },
}));

const intlSpy = vi.fn();
vi.mock("@/i18n/client-provider", () => ({
  DynamicIntlProvider: (props: Record<string, unknown>) => {
    intlSpy(props);
    return <>{props.children as ReactNode}</>;
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("@/auth/client", () => ({
  authClient: { fake: true },
}));

describe("Providers", () => {
  const defaultProps = {
    locale: "en" as const,
    messages: {},
  };

  it("renders children", () => {
    render(
      <Providers {...defaultProps}>
        <div data-testid="child">hello</div>
      </Providers>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders without errors for valid props", () => {
    expect(() =>
      render(<Providers {...defaultProps}>content</Providers>)
    ).not.toThrow();
  });

  it("includes Toaster in the output", () => {
    render(<Providers {...defaultProps}>content</Providers>);

    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("forwards locale and messages to DynamicIntlProvider", () => {
    intlSpy.mockClear();
    const messages = { key: "val" };
    render(
      <Providers locale="fr" messages={messages}>
        content
      </Providers>
    );

    expect(intlSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialLocale: "fr",
        initialMessages: messages,
      })
    );
  });

  it("forwards authClient to NeonAuthUIProvider", () => {
    neonAuthSpy.mockClear();
    render(<Providers {...defaultProps}>content</Providers>);

    expect(neonAuthSpy).toHaveBeenCalledWith(
      expect.objectContaining({ authClient: { fake: true } })
    );
  });
});
