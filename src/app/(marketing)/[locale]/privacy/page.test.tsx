import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  const defaultParams = { params: Promise.resolve({ locale: "en" }) };

  it("renders the privacy policy title", async () => {
    render(await PrivacyPage(defaultParams));

    expect(
      screen.getByRole("heading", { level: 1, name: "privacy.title" })
    ).toBeInTheDocument();
  });

  it("renders all privacy sections", async () => {
    render(await PrivacyPage(defaultParams));

    const sectionHeadings = screen.getAllByRole("heading", { level: 2 });
    expect(sectionHeadings).toHaveLength(5);
  });

  it("renders section titles with correct translation keys", async () => {
    render(await PrivacyPage(defaultParams));

    expect(screen.getByText("privacy.dataCollectTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.dataUseTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.dataStorageTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.rightsTitle")).toBeInTheDocument();
    expect(screen.getByText("privacy.analyticsTitle")).toBeInTheDocument();
  });

  it("renders the intro paragraph", async () => {
    render(await PrivacyPage(defaultParams));

    expect(screen.getByText("privacy.intro")).toBeInTheDocument();
  });
});
