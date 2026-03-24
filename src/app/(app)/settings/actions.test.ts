import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockSession {
  data: {
    user: { id: string } | null;
  };
}

const authenticatedSession: MockSession = {
  data: { user: { id: "test-user" } },
};

const unauthenticatedSession: MockSession = {
  data: { user: null },
};

vi.mock("server-only", () => ({}));
const mockIsUserBanned = vi.fn().mockResolvedValue(false);
vi.mock("@/auth/ban-check", () => ({
  isUserBanned: (...args: unknown[]) => mockIsUserBanned(...args),
}));

const mockCookieDelete = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({ delete: mockCookieDelete });
vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/auth/server", () => ({
  auth: {
    getSession: vi.fn().mockResolvedValue(authenticatedSession),
  },
}));

vi.mock("@/db/schema/users", () => ({
  users: {
    id: "id",
    locale: "locale",
    theme: "theme",
    deletedAt: "deleted_at",
  },
}));

const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: "test-user" }]);
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockSelectLimit = vi.fn().mockResolvedValue([]);
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

vi.mock("@/db", () => ({
  getDb: () => ({
    update: mockUpdate,
    select: mockSelect,
  }),
}));

describe("settings server actions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockIsUserBanned.mockResolvedValue(false);
    mockUpdateReturning.mockResolvedValue([{ id: "test-user" }]);
    mockSelectLimit.mockResolvedValue([]);
  });

  describe("banned user rejection", () => {
    it("updateLocale rejects banned users", async () => {
      mockIsUserBanned.mockResolvedValueOnce(true);

      const { updateLocale } = await import("./actions");
      const result = await updateLocale("en");
      expect(result).toEqual({ success: false, error: "Account suspended" });
    });

    it("updateTheme rejects banned users", async () => {
      mockIsUserBanned.mockResolvedValueOnce(true);

      const { updateTheme } = await import("./actions");
      const result = await updateTheme("dark");
      expect(result).toEqual({ success: false, error: "Account suspended" });
    });

    it("getUserSettings returns null for banned users", async () => {
      mockIsUserBanned.mockResolvedValueOnce(true);

      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toBeNull();
    });
  });

  describe("updateLocale", () => {
    it("returns error for an invalid locale", async () => {
      const { updateLocale } = await import("./actions");
      const result = await updateLocale("xx");
      expect(result).toEqual({ success: false, error: "Invalid locale" });
    });

    it("returns error for an empty locale", async () => {
      const { updateLocale } = await import("./actions");
      const result = await updateLocale("");
      expect(result).toEqual({ success: false, error: "Invalid locale" });
    });

    it("returns error when not authenticated", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { updateLocale } = await import("./actions");
      const result = await updateLocale("en");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("updates the DB for a valid locale", async () => {
      const { updateLocale } = await import("./actions");
      const result = await updateLocale("fr");

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledWith({ locale: "fr" });
      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });

    it("accepts all supported locales", async () => {
      const { updateLocale } = await import("./actions");
      const locales = ["en", "fr", "es", "pt", "it", "de", "nl"];

      for (const locale of locales) {
        const result = await updateLocale(locale);
        expect(result).toEqual({ success: true });
      }
    });

    it("returns error when user row does not exist", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      const { updateLocale } = await import("./actions");
      const result = await updateLocale("en");
      expect(result).toEqual({ success: false, error: "User not found" });
    });

    it("returns error when the DB update fails", async () => {
      mockUpdateReturning.mockRejectedValueOnce(
        new Error("DB connection lost")
      );

      const { updateLocale } = await import("./actions");
      const result = await updateLocale("en");
      expect(result).toEqual({
        success: false,
        error: "Failed to save locale",
      });
    });

    it("does not touch the DB for an invalid locale", async () => {
      const { updateLocale } = await import("./actions");
      await updateLocale("zz");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("deletes the user-synced cookie on successful update", async () => {
      const { updateLocale } = await import("./actions");
      await updateLocale("fr");

      expect(mockCookieDelete).toHaveBeenCalledWith("user-synced");
    });

    it("does not delete the user-synced cookie on failure", async () => {
      mockUpdateReturning.mockRejectedValueOnce(new Error("DB error"));

      const { updateLocale } = await import("./actions");
      await updateLocale("fr");

      expect(mockCookieDelete).not.toHaveBeenCalled();
    });

    it("returns error when user is soft-deleted", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      const { updateLocale } = await import("./actions");
      const result = await updateLocale("fr");
      expect(result).toEqual({ success: false, error: "User not found" });
    });
  });

  describe("updateTheme", () => {
    it("returns error for an invalid theme", async () => {
      const { updateTheme } = await import("./actions");
      const result = await updateTheme("blue");
      expect(result).toEqual({ success: false, error: "Invalid theme" });
    });

    it("returns error for an empty theme", async () => {
      const { updateTheme } = await import("./actions");
      const result = await updateTheme("");
      expect(result).toEqual({ success: false, error: "Invalid theme" });
    });

    it("returns error when not authenticated", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { updateTheme } = await import("./actions");
      const result = await updateTheme("dark");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("updates the DB for the light theme", async () => {
      const { updateTheme } = await import("./actions");
      const result = await updateTheme("light");

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledWith({ theme: "light" });
      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });

    it("updates the DB for the dark theme", async () => {
      const { updateTheme } = await import("./actions");
      const result = await updateTheme("dark");

      expect(result).toEqual({ success: true });
      expect(mockUpdateSet).toHaveBeenCalledWith({ theme: "dark" });
    });

    it("updates the DB for the system theme", async () => {
      const { updateTheme } = await import("./actions");
      const result = await updateTheme("system");

      expect(result).toEqual({ success: true });
      expect(mockUpdateSet).toHaveBeenCalledWith({ theme: "system" });
    });

    it("returns error when user row does not exist", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      const { updateTheme } = await import("./actions");
      const result = await updateTheme("dark");
      expect(result).toEqual({ success: false, error: "User not found" });
    });

    it("returns error when the DB update fails", async () => {
      mockUpdateReturning.mockRejectedValueOnce(new Error("DB timeout"));

      const { updateTheme } = await import("./actions");
      const result = await updateTheme("dark");
      expect(result).toEqual({ success: false, error: "Failed to save theme" });
    });

    it("does not touch the DB for an invalid theme", async () => {
      const { updateTheme } = await import("./actions");
      await updateTheme("invalid");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("deletes the user-synced cookie on successful update", async () => {
      const { updateTheme } = await import("./actions");
      await updateTheme("dark");

      expect(mockCookieDelete).toHaveBeenCalledWith("user-synced");
    });

    it("does not delete the user-synced cookie on failure", async () => {
      mockUpdateReturning.mockRejectedValueOnce(new Error("DB error"));

      const { updateTheme } = await import("./actions");
      await updateTheme("dark");

      expect(mockCookieDelete).not.toHaveBeenCalled();
    });

    it("returns error when user is soft-deleted", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      const { updateTheme } = await import("./actions");
      const result = await updateTheme("dark");
      expect(result).toEqual({ success: false, error: "User not found" });
    });
  });

  describe("getUserSettings", () => {
    it("returns null when not authenticated", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toBeNull();
    });

    it("returns locale and theme from the DB", async () => {
      mockSelectLimit.mockResolvedValueOnce([{ locale: "fr", theme: "dark" }]);

      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toEqual({ locale: "fr", theme: "dark" });
    });

    it("queries the DB with the authenticated user id", async () => {
      mockSelectLimit.mockResolvedValueOnce([{ locale: "en", theme: "light" }]);

      const { getUserSettings } = await import("./actions");
      await getUserSettings();

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockSelectFrom).toHaveBeenCalledTimes(1);
      expect(mockSelectWhere).toHaveBeenCalledTimes(1);
      expect(mockSelectLimit).toHaveBeenCalledWith(1);
    });

    it("returns null when the user row is not found", async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toBeNull();
    });

    it("returns null when the DB read fails", async () => {
      mockSelectLimit.mockRejectedValueOnce(new Error("DB read error"));

      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toBeNull();
    });

    it("falls back to defaults when DB returns invalid locale and theme", async () => {
      mockSelectLimit.mockResolvedValueOnce([
        { locale: "xx", theme: "invalid" },
      ]);
      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toEqual({ locale: "en", theme: "system" });
    });

    it("does not query the DB when not authenticated", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { getUserSettings } = await import("./actions");
      await getUserSettings();
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns null when user is soft-deleted", async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { getUserSettings } = await import("./actions");
      const result = await getUserSettings();
      expect(result).toBeNull();
    });
  });
});
