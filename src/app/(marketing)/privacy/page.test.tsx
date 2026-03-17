import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("renders the privacy policy title", async () => {
    const element = await PrivacyPage();
    render(element);

    expect(
      screen.getByRole("heading", { level: 1, name: "privacy.title" })
    ).toBeInTheDocument();
  });

  it("renders all privacy sections", async () => {
    const element = await PrivacyPage();
    render(element);

    const sectionHeadings = screen.getAllByRole("heading", { level: 2 });
    expect(sectionHeadings).toHaveLength(5);
  });

  it("renders section titles with correct translation keys", async () => {
    const element = await PrivacyPage();
    render(element);

    expect(screen.getByText("privacy.dataCollectTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.dataUseTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.dataStorageTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.rightsTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.analyticsTitle")).toBeInTheDocument();
  });

  it("renders the intro paragraph", async () => {
    const element = await PrivacyPage();
    render(element);

    expect(screen.getByText("privacy.intro")).toBeInTheDocument();
  });
});
