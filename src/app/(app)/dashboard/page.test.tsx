import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

vi.mock("@/components/dashboard-grid", () => ({
  DashboardGrid: () => <div data-testid="dashboard-grid" />,
}));

vi.mock("@/components/collection-card", () => ({
  CollectionCard: () => <div data-testid="collection-card" />,
}));

vi.mock("@/components/repertoire-card", () => ({
  RepertoireCard: () => <div data-testid="repertoire-card" />,
}));

vi.mock("@/features/activity/components/recent-activity-card", () => ({
  RecentActivityCard: () => <div data-testid="recent-activity-card" />,
}));

interface MockSession {
  data: { user: { id: string; name: string } | null };
}

const mockGetSession = vi.fn<() => Promise<MockSession>>(() =>
  Promise.resolve({
    data: { user: { id: "user-1", name: "Test Magician" } },
  })
);

vi.mock("@/auth/server", () => ({
  auth: {
    getSession: () => mockGetSession(),
  },
}));

describe("DashboardPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockImplementation(() =>
      Promise.resolve({
        data: { user: { id: "user-1", name: "Test Magician" } },
      })
    );
  });

  it("renders the CollectionCard", async () => {
    render(await DashboardPage());
    expect(screen.getByTestId("collection-card")).toBeInTheDocument();
  });

  it("renders the RepertoireCard", async () => {
    render(await DashboardPage());
    expect(screen.getByTestId("repertoire-card")).toBeInTheDocument();
  });

  it("renders the RecentActivityCard", async () => {
    render(await DashboardPage());
    expect(screen.getByTestId("recent-activity-card")).toBeInTheDocument();
  });

  it("renders the DashboardGrid", async () => {
    render(await DashboardPage());
    expect(screen.getByTestId("dashboard-grid")).toBeInTheDocument();
  });

  it("renders the Dashboard heading", async () => {
    render(await DashboardPage());
    expect(
      screen.getByRole("heading", { name: "dashboard.title" })
    ).toBeInTheDocument();
  });

  it("renders a personalized welcome message when the user has a name", async () => {
    render(await DashboardPage());

    const welcomeSection = screen.getByRole("heading", {
      name: "dashboard.title",
    }).parentElement;
    expect(welcomeSection).toBeInTheDocument();

    const paragraph = welcomeSection?.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBeTruthy();
    expect(paragraph?.textContent).not.toBe("dashboard.welcome");
  });

  it("shows the generic welcome when session.user is falsy", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { user: null } });

    render(await DashboardPage());

    const welcomeSection = screen.getByRole("heading", {
      name: "dashboard.title",
    }).parentElement;
    const paragraph = welcomeSection?.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBeTruthy();
  });

  it("throws when getSession rejects", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("Auth service down"));
    await expect(DashboardPage()).rejects.toThrow("Auth service down");
  });
});
