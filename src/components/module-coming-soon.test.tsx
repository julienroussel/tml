import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModuleComingSoon } from "./module-coming-soon";

describe("ModuleComingSoon", () => {
  it("renders module label and description", () => {
    render(<ModuleComingSoon slug="improve" />);

    expect(screen.getByText("Improve")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Track practice sessions and refine your skills over time."
      )
    ).toBeInTheDocument();
  });

  it("renders the coming soon badge", () => {
    render(<ModuleComingSoon slug="train" />);

    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText("Train")).toBeInTheDocument();
    expect(
      screen.getByText("Set goals, run drills, and build muscle memory.")
    ).toBeInTheDocument();
  });

  it("renders the module icon", () => {
    const { container } = render(<ModuleComingSoon slug="improve" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
