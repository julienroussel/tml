import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/test/mocks";
import { ThemeSelector } from "./theme-selector";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: mockSetTheme,
  }),
}));

vi.mock("@/app/(app)/settings/actions", () => ({
  updateTheme: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

describe("ThemeSelector", () => {
  it("renders 3 radio options after mount", () => {
    render(<ThemeSelector currentTheme="system" />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("selects the current theme by default", () => {
    render(<ThemeSelector currentTheme="dark" />);

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    const darkRadio = radios.find((r) => r.value === "dark");
    expect(darkRadio?.checked).toBe(true);
  });

  it("calls setTheme and updateTheme on selection", async () => {
    const { updateTheme } = await import("@/app/(app)/settings/actions");
    const user = userEvent.setup();

    render(<ThemeSelector currentTheme="light" />);

    const radios = screen.getAllByRole("radio");
    const darkRadio = radios.find(
      (r) => (r as HTMLInputElement).value === "dark"
    );
    if (!darkRadio) {
      throw new Error("Dark radio not found");
    }

    await user.click(darkRadio);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(updateTheme).toHaveBeenCalledWith("dark");
  });

  it("tracks analytics event on theme change", async () => {
    const { trackEvent } = await import("@/lib/analytics");
    const user = userEvent.setup();

    render(<ThemeSelector currentTheme="light" />);

    const radios = screen.getAllByRole("radio");
    const darkRadio = radios.find(
      (r) => (r as HTMLInputElement).value === "dark"
    );
    if (!darkRadio) {
      throw new Error("Dark radio not found");
    }

    await user.click(darkRadio);

    expect(trackEvent).toHaveBeenCalledWith("theme_changed", {
      theme: "dark",
    });
  });

  it("displays translated labels for each theme option", () => {
    render(<ThemeSelector currentTheme="system" />);

    // Global next-intl mock returns "namespace.key" format
    expect(screen.getByText("settings.themeLight")).toBeInTheDocument();
    expect(screen.getByText("settings.themeDark")).toBeInTheDocument();
    expect(screen.getByText("settings.themeSystem")).toBeInTheDocument();
  });
});
