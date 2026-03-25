import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NeonAuthLocalizedProvider } from "./neon-auth-localized-provider";

const neonAuthSpy = vi.fn();

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useMessages: vi.fn(() => ({
      auth: { SIGN_IN: "Connexion", SIGN_UP: "Inscription" },
      common: { save: "Enregistrer" },
    })),
  };
});

vi.mock("@neondatabase/auth/react", () => ({
  NeonAuthUIProvider: (props: Record<string, unknown>) => {
    neonAuthSpy(props);
    return <>{props.children as ReactNode}</>;
  },
}));

vi.mock("@/auth/client", () => ({
  authClient: { fake: true },
}));

describe("NeonAuthLocalizedProvider", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <NeonAuthLocalizedProvider>
        <div data-testid="child">content</div>
      </NeonAuthLocalizedProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("extracts auth namespace and passes as localization", () => {
    render(<NeonAuthLocalizedProvider>content</NeonAuthLocalizedProvider>);

    expect(neonAuthSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        localization: { SIGN_IN: "Connexion", SIGN_UP: "Inscription" },
      })
    );
  });

  it("forwards authClient, emailOTP, and social to NeonAuthUIProvider", () => {
    render(<NeonAuthLocalizedProvider>content</NeonAuthLocalizedProvider>);

    expect(neonAuthSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        authClient: { fake: true },
        emailOTP: true,
        social: { providers: ["google"] },
      })
    );
  });
});
