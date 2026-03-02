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
  it("renders the not found heading", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument();
  });

  it("renders a description", () => {
    render(<NotFound />);
    expect(
      screen.getByText("The page you're looking for doesn't exist.")
    ).toBeInTheDocument();
  });

  it("renders within a main landmark", () => {
    render(<NotFound />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders a link to the home page", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: "Go to homepage" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
