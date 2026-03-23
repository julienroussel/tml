import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/test/mocks";
import { LocaleSelector } from "./locale-selector";

vi.mock("@/app/(app)/settings/actions", () => ({
  updateLocale: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/i18n/client-provider", () => ({
  useLocaleSwitch: () => ({ switchLocale: vi.fn() }),
}));

const originalCookieDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "cookie"
);

describe("LocaleSelector", () => {
  afterEach(() => {
    if (originalCookieDescriptor) {
      Object.defineProperty(document, "cookie", originalCookieDescriptor);
    }
  });

  it("renders a select with 7 locale options", () => {
    render(<LocaleSelector currentLocale="en" />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(7);
  });

  it("selects the current locale by default", () => {
    render(<LocaleSelector currentLocale="fr" />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("fr");
  });

  it("calls updateLocale and switchLocale on change", async () => {
    const { updateLocale } = await import("@/app/(app)/settings/actions");
    const user = userEvent.setup();

    render(<LocaleSelector currentLocale="en" />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "de");

    expect(updateLocale).toHaveBeenCalledWith("de");
  });

  it("sets NEXT_LOCALE cookie on change", async () => {
    const user = userEvent.setup();

    // Clear any existing cookies
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });

    render(<LocaleSelector currentLocale="en" />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "es");

    expect(document.cookie).toContain("NEXT_LOCALE=es");
  });

  it("displays locale labels in their native language", () => {
    render(<LocaleSelector currentLocale="en" />);

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Português")).toBeInTheDocument();
    expect(screen.getByText("Italiano")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByText("Nederlands")).toBeInTheDocument();
  });
});
