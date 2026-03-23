import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsRestorer } from "./settings-restorer";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
}));

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: undefined,
    setTheme: mockSetTheme,
  }),
}));

const mockUpdateLocale = vi.fn<(locale: string) => Promise<{ success: true }>>(
  () => Promise.resolve({ success: true })
);
const mockUpdateTheme = vi.fn<(theme: string) => Promise<{ success: true }>>(
  () => Promise.resolve({ success: true })
);

vi.mock("@/app/(app)/settings/actions", () => ({
  updateLocale: (locale: string) => mockUpdateLocale(locale),
  updateTheme: (theme: string) => mockUpdateTheme(theme),
}));

// Provide a minimal localStorage stub for JSDOM
const localStorageStore: Record<string, string> = {};
const localStorageStub = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(localStorageStore)) {
      delete localStorageStore[key];
    }
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageStub,
  writable: true,
});

const originalCookieDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "cookie"
);

describe("SettingsRestorer", () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Restore the original cookie descriptor to prevent leaks
    if (originalCookieDescriptor) {
      Object.defineProperty(document, "cookie", originalCookieDescriptor);
    }
    // Clear any cookies set during the test via the restored native descriptor
    // biome-ignore lint/suspicious/noDocumentCookie: test cleanup requires direct cookie manipulation to expire test cookies
    document.cookie = "NEXT_LOCALE=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    // biome-ignore lint/suspicious/noDocumentCookie: test cleanup requires direct cookie manipulation to expire test cookies
    document.cookie = "user-synced=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorageStub.clear();
  });

  it("restores locale from DB when no cookie exists and locale is non-default", () => {
    render(<SettingsRestorer dbLocale="fr" dbTheme="system" userId="user-1" />);

    // Should set the cookie from DB value
    expect(document.cookie).toContain("NEXT_LOCALE=fr");
    // Should trigger refresh since locale changed
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("sets cookie and refreshes when DB locale is 'en' and no cookie exists", () => {
    render(<SettingsRestorer dbLocale="en" dbTheme="system" userId="user-1" />);

    // Cookie IS set (so Accept-Language negotiation doesn't override explicit "en")
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    // Always refresh on new device — server may have negotiated a different
    // locale via Accept-Language (e.g., "fr" for a French browser)
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("syncs offline locale change from cookie to DB when they differ", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "NEXT_LOCALE=es",
    });

    render(<SettingsRestorer dbLocale="en" dbTheme="system" userId="user-1" />);

    expect(mockUpdateLocale).toHaveBeenCalledWith("es");
  });

  it("does not sync locale when cookie matches DB", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "NEXT_LOCALE=fr",
    });

    render(<SettingsRestorer dbLocale="fr" dbTheme="system" userId="user-1" />);

    expect(mockUpdateLocale).not.toHaveBeenCalled();
  });

  it("restores theme from DB when no local theme is set", () => {
    render(<SettingsRestorer dbLocale="en" dbTheme="dark" userId="user-1" />);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("does not restore theme when DB theme is system (default)", () => {
    render(<SettingsRestorer dbLocale="en" dbTheme="system" userId="user-1" />);

    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("does not sync theme when localStorage matches DB", () => {
    localStorageStore.theme = "dark";
    render(<SettingsRestorer dbLocale="en" dbTheme="dark" userId="user-1" />);
    expect(mockUpdateTheme).not.toHaveBeenCalled();
  });

  it("syncs offline theme change from localStorage to DB when they differ", () => {
    localStorageStore.theme = "dark";

    render(<SettingsRestorer dbLocale="en" dbTheme="light" userId="user-1" />);

    expect(mockUpdateTheme).toHaveBeenCalledWith("dark");
  });

  it("renders nothing (returns null)", () => {
    const { container } = render(
      <SettingsRestorer dbLocale="en" dbTheme="system" userId="user-1" />
    );

    expect(container.innerHTML).toBe("");
  });

  it("sets user-synced cookie after sync", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "NEXT_LOCALE=en",
    });

    render(<SettingsRestorer dbLocale="en" dbTheme="system" userId="user-1" />);

    expect(document.cookie).toContain("user-synced=user-1|en|system");
  });

  it("sets user-synced cookie with resolved locale from offline change", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "NEXT_LOCALE=es",
    });

    render(<SettingsRestorer dbLocale="en" dbTheme="dark" userId="user-1" />);

    // Locale should be the cookie value (local wins on offline change)
    expect(document.cookie).toContain("user-synced=user-1|es|dark");
  });
});
