import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModuleComingSoon } from "./module-coming-soon";

describe("ModuleComingSoon", () => {
  it("renders module label and description", async () => {
    const element = await ModuleComingSoon({ slug: "improve" });
    render(element);

    expect(screen.getByText("improve.title")).toBeInTheDocument();
    expect(screen.getByText("improve.description")).toBeInTheDocument();
  });

  it("renders the coming soon badge", async () => {
    const element = await ModuleComingSoon({ slug: "train" });
    render(element);

    expect(screen.getByText("common.comingSoon")).toBeInTheDocument();
    expect(screen.getByText("train.title")).toBeInTheDocument();
    expect(screen.getByText("train.description")).toBeInTheDocument();
  });

  it("renders the module icon", async () => {
    const element = await ModuleComingSoon({ slug: "improve" });
    const { container } = render(element);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
