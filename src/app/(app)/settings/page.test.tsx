import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockNextNavigation } from "@/test/mocks";

const THEME_DARK_PATTERN = /themeDark/i;

mockNextNavigation();

vi.mock("server-only", () => ({}));

const mockGetUserSettings = vi.fn().mockResolvedValue({
  locale: "en",
  theme: "system",
});

vi.mock("@/app/(app)/settings/actions", () => ({
  getUserSettings: mockGetUserSettings,
  updateLocale: vi.fn().mockResolvedValue({ success: true }),
  updateTheme: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next-themes", () => ({
  useTheme: vi.fn().mockReturnValue({
    setTheme: vi.fn(),
    resolvedTheme: "light",
    themes: ["light", "dark", "system"],
  }),
}));

describe("SettingsPage", () => {
  it("renders the settings title", async () => {
    const { default: SettingsPage } = await import("./page");
    const element = await SettingsPage();
    render(element);

    expect(
      screen.getByRole("heading", { name: "settings.title" })
    ).toBeInTheDocument();
  });

  it("renders the settings description", async () => {
    const { default: SettingsPage } = await import("./page");
    const element = await SettingsPage();
    render(element);

    expect(screen.getByText("settings.description")).toBeInTheDocument();
  });

  it("renders locale selector with current locale", async () => {
    const { default: SettingsPage } = await import("./page");
    const element = await SettingsPage();
    render(element);

    const select = screen.getByLabelText("settings.language");
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("en");
  });

  it("renders theme selector with current theme from DB", async () => {
    mockGetUserSettings.mockResolvedValueOnce({
      locale: "en",
      theme: "dark",
    });
    const { default: SettingsPage } = await import("./page");
    const element = await SettingsPage();
    render(element);

    expect(screen.getByText("settings.theme")).toBeInTheDocument();
    const darkRadio = screen.getByRole("radio", { name: THEME_DARK_PATTERN });
    expect(darkRadio).toBeChecked();
  });

  it("falls back to defaults when getUserSettings returns null", async () => {
    mockGetUserSettings.mockResolvedValueOnce(null);
    const { default: SettingsPage } = await import("./page");
    const element = await SettingsPage();
    render(element);

    const select = screen.getByLabelText("settings.language");
    expect(select).toHaveValue("en");
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
