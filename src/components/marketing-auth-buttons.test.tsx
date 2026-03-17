import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarketingAuthButtons } from "./marketing-auth-buttons";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/auth/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: null, isPending: false })),
  },
}));

describe("MarketingAuthButtons", () => {
  it("renders sign-in and get-started links when not authenticated", () => {
    render(<MarketingAuthButtons />);

    const signInLink = screen.getByRole("link", { name: "common.signIn" });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute("href", "/auth/sign-in");

    const getStartedLink = screen.getByRole("link", {
      name: "common.getStarted",
    });
    expect(getStartedLink).toBeInTheDocument();
    expect(getStartedLink).toHaveAttribute("href", "/auth/sign-up");
  });

  it("renders loading skeletons when session is pending", async () => {
    const { authClient } = await import("@/auth/client");
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: true,
    } as ReturnType<typeof authClient.useSession>);

    const { container } = render(<MarketingAuthButtons />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("common.signIn")).not.toBeInTheDocument();
    // Component renders two Skeleton elements during pending state
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBe(2);
  });

  it("renders dashboard link when authenticated", async () => {
    const { authClient } = await import("@/auth/client");
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "1", name: "Test" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);

    render(<MarketingAuthButtons />);

    const dashboardLink = screen.getByRole("link", {
      name: "common.goToDashboard",
    });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("does not render sign-in links when authenticated", async () => {
    const { authClient } = await import("@/auth/client");
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "1", name: "Test" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);

    render(<MarketingAuthButtons />);

    expect(screen.queryByText("common.signIn")).not.toBeInTheDocument();
    expect(screen.queryByText("common.getStarted")).not.toBeInTheDocument();
  });
});
