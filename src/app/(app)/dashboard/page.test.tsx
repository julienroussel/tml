import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

vi.mock("@/components/dashboard-grid", () => ({
  DashboardGrid: () => <div data-testid="dashboard-grid" />,
}));

describe("DashboardPage", () => {
  it("renders the Dashboard heading", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument();
  });

  it("renders the welcome message", () => {
    render(<DashboardPage />);

    expect(
      screen.getByText(
        "Welcome to The Magic Lab. Choose a module to get started."
      )
    ).toBeInTheDocument();
  });

  it("renders the DashboardGrid component", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("dashboard-grid")).toBeInTheDocument();
  });
});
