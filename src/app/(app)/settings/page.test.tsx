import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SettingsPage from "./page";

describe("SettingsPage", () => {
  it("renders the settings title", async () => {
    const element = await SettingsPage();
    render(element);

    expect(
      screen.getByRole("heading", { name: "settings.title" })
    ).toBeInTheDocument();
  });

  it("renders the settings description", async () => {
    const element = await SettingsPage();
    render(element);

    expect(screen.getByText("settings.description")).toBeInTheDocument();
  });

  it("renders the coming soon badge", async () => {
    const element = await SettingsPage();
    render(element);

    expect(screen.getByText("common.comingSoon")).toBeInTheDocument();
  });

  it("exports correct metadata", async () => {
    const { metadata } = await import("./page");
    expect(metadata).toEqual(
      expect.objectContaining({
        title: "Settings",
        description: "Manage your account and preferences.",
      })
    );
  });
});
