import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockNextImage, mockNextLink } from "@/test/mocks";
import Home from "./page";

mockNextImage();
mockNextLink();

const GITHUB_RE = /GitHub/;

describe("Home (marketing landing page)", () => {
  it("renders the heading", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the trust bar section", async () => {
    render(await Home());
    expect(screen.getByLabelText("Key benefits")).toBeInTheDocument();
  });

  it("renders the hero section with tagline paragraph", async () => {
    const { container } = render(await Home());
    const heroTitle = container.querySelector("#hero-title");
    expect(heroTitle).toBeInTheDocument();
    // Hero section contains at least one paragraph (the tagline)
    const heroSection = heroTitle?.closest("section");
    expect(heroSection).toBeInTheDocument();
    const paragraphs = heroSection?.querySelectorAll("p") ?? [];
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Get Started CTA linking to sign-up", async () => {
    render(await Home());
    const ctas = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/auth/sign-up");
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it("renders feature section with all 6 modules", async () => {
    render(await Home());
    const featureSection = document.getElementById("features");
    expect(featureSection).toBeInTheDocument();
    // Each module renders as a link with an h3 heading
    const headings =
      featureSection?.parentElement?.querySelectorAll("h3") ?? [];
    expect(headings).toHaveLength(6);
  });

  it("renders the GitHub link with correct attributes", async () => {
    render(await Home());
    const links = screen.getAllByRole("link", { name: GITHUB_RE });
    const externalLink = links.find(
      (link) =>
        link.getAttribute("href") === "https://github.com/julienroussel/tml"
    );
    expect(externalLink).toBeDefined();
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders both logo images", async () => {
    render(await Home());
    const images = screen.getAllByRole("presentation");
    const logos = images.filter(
      (img) =>
        img.getAttribute("src") === "/logo-light.svg" ||
        img.getAttribute("src") === "/logo-dark.svg"
    );
    expect(logos).toHaveLength(2);
  });

  it("renders trust bar with at least 3 badges", async () => {
    render(await Home());
    const trustBar = screen.getByLabelText("Key benefits");
    const badges = trustBar.querySelectorAll("span");
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the how it works section with steps", async () => {
    render(await Home());
    const section = document.getElementById("how-it-works");
    expect(section).toBeInTheDocument();
    // Section has 3 step headings
    const headings = section?.parentElement?.querySelectorAll("h3") ?? [];
    expect(headings).toHaveLength(3);
  });

  it("renders the open source section", async () => {
    render(await Home());
    const section = document.getElementById("open-source");
    expect(section).toBeInTheDocument();
    expect(section?.tagName).toBe("H2");
  });

  it("renders JSON-LD structured data", async () => {
    const { container } = render(await Home());
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script?.textContent ?? "{}");
    expect(data["@type"]).toBe("SoftwareApplication");
  });
});
