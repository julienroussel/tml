import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockNextImage, mockNextLink } from "@/test/mocks";
import { Logo } from "./logo";

mockNextImage();
mockNextLink();

describe("Logo", () => {
  it("renders a link to '/' by default", () => {
    render(<Logo height={40} width={120} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders a link to custom href when provided", () => {
    render(<Logo height={40} href="/dashboard" width={120} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("renders light and dark mode images", () => {
    render(<Logo height={40} width={120} />);
    const images = screen.getAllByRole("presentation");
    const srcs = images.map((img) => img.getAttribute("src"));
    expect(srcs).toContain("/logo-light.svg");
    expect(srcs).toContain("/logo-dark.svg");
  });

  it("includes sr-only 'The Magic Lab' text for accessibility", () => {
    render(<Logo height={40} width={120} />);
    expect(screen.getByText("The Magic Lab")).toBeInTheDocument();
  });

  it("passes className to the link wrapper", () => {
    render(<Logo className="my-class" height={40} width={120} />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("my-class");
  });

  it("sets loading='eager' on images", () => {
    render(<Logo height={40} width={120} />);
    const images = screen.getAllByRole("presentation");
    for (const img of images) {
      expect(img).toHaveAttribute("loading", "eager");
    }
  });
});
