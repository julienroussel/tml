import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: (namespace?: string) => {
    const t = (key: string) => (namespace ? `${namespace}.${key}` : key);
    return Promise.resolve(Object.assign(t, { rich: t, raw: t, markup: t }));
  },
}));

vi.mock("@/components/locale-toggle", () => ({
  LocaleToggle: () => <div data-testid="locale-toggle" />,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@/components/logo", () => ({
  Logo: (props: Record<string, unknown>) => (
    <div data-testid="logo" {...props} />
  ),
}));

const authViewSpy = vi.fn();
vi.mock("@neondatabase/auth/react", () => ({
  AuthView: (props: Record<string, unknown>) => {
    authViewSpy(props);
    return <div data-testid="auth-view" />;
  },
}));

vi.mock("@neondatabase/auth/react/ui/server", () => ({
  authViewPaths: ["sign-in", "sign-up"],
}));

import AuthPage from "./page";

describe("AuthPage", () => {
  it("renders AuthView with the correct path from params", async () => {
    render(await AuthPage({ params: Promise.resolve({ path: "sign-in" }) }));

    expect(authViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: "sign-in" })
    );
  });

  it("passes callbackURL='/dashboard' to AuthView", async () => {
    render(await AuthPage({ params: Promise.resolve({ path: "sign-up" }) }));

    expect(authViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/dashboard" })
    );
  });

  it("renders LocaleToggle and ThemeToggle inside a nav element", async () => {
    render(await AuthPage({ params: Promise.resolve({ path: "sign-in" }) }));

    const nav = screen.getByRole("navigation");
    expect(nav).toContainElement(screen.getByTestId("locale-toggle"));
    expect(nav).toContainElement(screen.getByTestId("theme-toggle"));
  });

  it("nav has translated aria-label from common.pageSettings", async () => {
    render(await AuthPage({ params: Promise.resolve({ path: "sign-in" }) }));

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "common.pageSettings");
  });

  it("renders Logo with expected dimensions", async () => {
    render(await AuthPage({ params: Promise.resolve({ path: "sign-in" }) }));

    const logo = screen.getByTestId("logo");
    expect(logo).toHaveAttribute("height", "56");
    expect(logo).toHaveAttribute("width", "168");
  });

  it("main element has id='main-content'", async () => {
    render(await AuthPage({ params: Promise.resolve({ path: "sign-in" }) }));

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
