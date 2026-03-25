import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleToggle } from "./locale-toggle";

const { mockSwitchLocale, mockSetLocaleCookie, mockTrackEvent, mockPush } =
  vi.hoisted(() => ({
    mockSwitchLocale: vi.fn(),
    mockSetLocaleCookie: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockPush: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}));

vi.mock("@/i18n/client-provider", () => ({
  useLocaleSwitch: () => ({ switchLocale: mockSwitchLocale }),
}));

vi.mock("@/features/settings/locale-cookie", () => ({
  setLocaleCookie: mockSetLocaleCookie,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: mockTrackEvent,
}));

describe("LocaleToggle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button after mount", () => {
    render(<LocaleToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("shows translated aria-label", () => {
    render(<LocaleToggle />);
    const button = screen.getByRole("button", {
      name: "common.changeLanguage",
    });
    expect(button).toBeInTheDocument();
  });

  it("renders Globe icon", () => {
    render(<LocaleToggle />);
    const button = screen.getByRole("button", {
      name: "common.changeLanguage",
    });
    const svg = button.querySelector("svg.lucide-globe");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("opens dropdown with all 7 locales", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));
    const items = screen.getAllByRole("menuitemradio");
    expect(items).toHaveLength(7);
  });

  it("displays locale autonyms with correct lang attributes", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const francais = screen.getByText("Français");
    expect(francais).toHaveAttribute("lang", "fr");

    const deutsch = screen.getByText("Deutsch");
    expect(deutsch).toHaveAttribute("lang", "de");
  });

  it("marks the current locale as checked", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const englishItem = screen.getByRole("menuitemradio", { name: "English" });
    expect(englishItem).toHaveAttribute("aria-checked", "true");
  });

  it("calls setLocaleCookie, switchLocale, and trackEvent on selection", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const frenchItem = screen.getByRole("menuitemradio", { name: "Français" });
    await user.click(frenchItem);

    expect(mockSetLocaleCookie).toHaveBeenCalledWith("fr");
    expect(mockSwitchLocale).toHaveBeenCalledWith("fr");
    expect(mockTrackEvent).toHaveBeenCalledWith("locale_changed", {
      locale: "fr",
    });
  });

  it("does not navigate on non-marketing pages", async () => {
    vi.mocked(usePathname).mockReturnValue("/auth/sign-in");

    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const frenchItem = screen.getByRole("menuitemradio", { name: "Français" });
    await user.click(frenchItem);

    expect(mockSetLocaleCookie).toHaveBeenCalledWith("fr");
    expect(mockSwitchLocale).toHaveBeenCalledWith("fr");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates to locale-prefixed URL on marketing pages", async () => {
    vi.mocked(usePathname).mockReturnValue("/en");

    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const frenchItem = screen.getByRole("menuitemradio", { name: "Français" });
    await user.click(frenchItem);

    expect(mockSetLocaleCookie).toHaveBeenCalledWith("fr");
    expect(mockSwitchLocale).toHaveBeenCalledWith("fr");
    expect(mockPush).toHaveBeenCalledWith("/fr");
  });

  it("preserves subpath when navigating on marketing pages", async () => {
    vi.mocked(usePathname).mockReturnValue("/en/faq");

    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const spanishItem = screen.getByRole("menuitemradio", {
      name: "Español",
    });
    await user.click(spanishItem);

    expect(mockPush).toHaveBeenCalledWith("/es/faq");
  });

  it("does not fire side effects when re-selecting the current locale", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));
    const englishItem = screen.getByRole("menuitemradio", { name: "English" });
    await user.click(englishItem);
    expect(mockSetLocaleCookie).not.toHaveBeenCalled();
    expect(mockSwitchLocale).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("handles multiple consecutive locale selections", async () => {
    const user = userEvent.setup();
    render(<LocaleToggle />);
    await user.click(screen.getByRole("button"));

    const frenchItem = screen.getByRole("menuitemradio", { name: "Français" });
    await user.click(frenchItem);
    expect(mockSetLocaleCookie).toHaveBeenCalledWith("fr");

    vi.clearAllMocks();

    await user.click(screen.getByRole("button"));
    const germanItem = screen.getByRole("menuitemradio", { name: "Deutsch" });
    await user.click(germanItem);
    expect(mockSetLocaleCookie).toHaveBeenCalledWith("de");
    expect(mockSwitchLocale).toHaveBeenCalledWith("de");
    expect(mockTrackEvent).toHaveBeenCalledWith("locale_changed", {
      locale: "de",
    });
  });
});
