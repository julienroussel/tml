import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FaqPage from "./page";

describe("FaqPage", () => {
  it("renders the FAQ title", async () => {
    const element = await FaqPage();
    render(element);

    expect(
      screen.getByRole("heading", { level: 1, name: "faq.title" })
    ).toBeInTheDocument();
  });

  it("renders all 9 FAQ items", async () => {
    const element = await FaqPage();
    render(element);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(9);
  });

  it("renders question and answer pairs with correct keys", async () => {
    const element = await FaqPage();
    render(element);

    expect(screen.getByText("faq.q1")).toBeInTheDocument();
    expect(screen.getByText("faq.a1")).toBeInTheDocument();
    expect(screen.getByText("faq.q9")).toBeInTheDocument();
    expect(screen.getByText("faq.a9")).toBeInTheDocument();
  });

  it("includes JSON-LD structured data", async () => {
    const element = await FaqPage();
    const { container } = render(element);

    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(script).toBeInTheDocument();

    const data = JSON.parse(script?.textContent ?? "{}");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(9);
  });
});
