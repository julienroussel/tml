import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders with default variant and size", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button.dataset.variant).toBe("default");
    expect(button.dataset.size).toBe("default");
  });

  it.each([
    "default",
    "destructive",
    "outline",
    "secondary",
    "ghost",
    "link",
  ] as const)("renders with variant: %s", (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    const button = screen.getByRole("button", { name: variant });
    expect(button).toBeInTheDocument();
    expect(button.dataset.variant).toBe(variant);
  });

  it.each([
    "default",
    "xs",
    "sm",
    "lg",
    "icon",
    "icon-xs",
    "icon-sm",
    "icon-lg",
  ] as const)("renders with size: %s", (size) => {
    render(<Button size={size}>{size}</Button>);
    const button = screen.getByRole("button", { name: size });
    expect(button).toBeInTheDocument();
    expect(button.dataset.size).toBe(size);
  });

  it("forwards additional props", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Styled</Button>);
    const button = screen.getByRole("button", { name: "Styled" });
    expect(button).toHaveClass("custom-class");
  });

  it("renders as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Link Button" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });
});
