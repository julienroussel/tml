import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

vi.mock("@/components/dashboard-grid", () => ({
  DashboardGrid: () => <div data-testid="dashboard-grid" />,
}));

vi.mock("@/components/repertoire-card", () => ({
  RepertoireCard: ({ trickCount }: { trickCount: number }) => (
    <div data-count={trickCount} data-testid="repertoire-card" />
  ),
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

const mockWhere = vi.fn(() => Promise.resolve([{ count: 3 }]));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
  })),
}));

const mockAnd = vi.fn((...args: unknown[]) => args);
const mockCount = vi.fn(() => "count()");
const mockEq = vi.fn(
  (col: unknown, val: unknown) => `eq(${String(col)},${String(val)})`
);
const mockIsNull = vi.fn((col: unknown) => `isNull(${String(col)})`);

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => mockAnd(...args),
  count: () => mockCount(),
  eq: (col: unknown, val: unknown) => mockEq(col, val),
  isNull: (col: unknown) => mockIsNull(col),
}));

vi.mock("@/db/schema/tricks", () => ({
  tricks: {
    userId: "tricks.userId",
    deletedAt: "tricks.deletedAt",
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
    mockWhere.mockImplementation(() => Promise.resolve([{ count: 3 }]));
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
  });

  it("renders the Dashboard heading", async () => {
    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { name: "dashboard.title" })
    ).toBeInTheDocument();
  });

  it("renders a personalized welcome message", async () => {
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

  it("renders the DashboardGrid component", async () => {
    render(await DashboardPage());

    expect(screen.getByTestId("dashboard-grid")).toBeInTheDocument();
  });

  it("renders the RepertoireCard with the correct trickCount", async () => {
    render(await DashboardPage());

    const card = screen.getByTestId("repertoire-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-count", "3");
  });

  it("queries the database with correct parameters", async () => {
    render(await DashboardPage());

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("tricks.userId", "user-1");
    expect(mockIsNull).toHaveBeenCalledWith("tricks.deletedAt");
    expect(mockAnd).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("shows generic welcome when session.user is falsy", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { user: null },
    });

    render(await DashboardPage());

    const welcomeSection = screen.getByRole("heading", {
      name: "dashboard.title",
    }).parentElement;
    const paragraph = welcomeSection?.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBeTruthy();
  });

  it("throws when DB query fails", async () => {
    mockWhere.mockRejectedValueOnce(new Error("DB connection failed"));

    await expect(DashboardPage()).rejects.toThrow("DB connection failed");
  });

  it("throws when getSession rejects", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("Auth service down"));

    await expect(DashboardPage()).rejects.toThrow("Auth service down");
  });

  it("skips DB query when userId is empty", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { user: { id: "", name: "No ID User" } },
    });

    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();

    render(await DashboardPage());

    const welcomeSection = screen.getByRole("heading", {
      name: "dashboard.title",
    }).parentElement;
    const paragraph = welcomeSection?.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toBeTruthy();

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockWhere).not.toHaveBeenCalled();
  });
});
