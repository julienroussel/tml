import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

vi.mock("next/link", () => ({
  // Simplified test mock — only handles string hrefs as used in this component
  default: ({
    children,
    href,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.ComponentPropsWithoutRef<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("NotFound", () => {
  it("renders the not found heading", async () => {
    const element = await NotFound();
    render(element);
    expect(
      screen.getByRole("heading", { name: "errors.notFound" })
    ).toBeInTheDocument();
  });

  it("renders a description", async () => {
    const element = await NotFound();
    render(element);
    expect(screen.getByText("errors.notFoundDesc")).toBeInTheDocument();
  });

  it("renders within a main landmark", async () => {
    const element = await NotFound();
    render(element);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders a link to the home page", async () => {
    const element = await NotFound();
    render(element);
    const link = screen.getByRole("link", { name: "errors.goHome" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
