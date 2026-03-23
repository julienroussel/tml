import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockAfter = vi.fn();
vi.mock("next/server", () => ({
  after: mockAfter,
}));

const mockCookieGet = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({ get: mockCookieGet });
vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

const mockReturning = vi.fn().mockResolvedValue([
  {
    id: "user-1",
    locale: "en",
    theme: "system",
    xmax: "1",
  },
]);
const mockOnConflictDoUpdate = vi.fn(() => ({
  returning: mockReturning,
}));
const mockValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
// Track preferences insert separately
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockPrefsValues = vi.fn(() => ({
  onConflictDoNothing: mockOnConflictDoNothing,
}));
// Distinguish tables by schema shape (has "userId" → user_preferences)
// instead of call order, so tests survive if production code reorders inserts.
const mockInsert = vi.fn((table: unknown) => {
  if (typeof table === "object" && table !== null && "userId" in table) {
    return { values: mockPrefsValues };
  }
  return { values: mockValues };
});
const mockGetDb = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/db", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/db/schema/users", () => ({
  users: {
    id: "id",
    email: { name: "email" },
    displayName: { name: "display_name" },
    locale: "locale",
    theme: "theme",
    updatedAt: "updated_at",
  },
}));

vi.mock("@/db/schema/user-preferences", () => ({
  userPreferences: { userId: "user_id" },
}));

const mockSendWelcomeEmail = vi.fn().mockResolvedValue({ id: "email-1" });
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));

const mockGetSession = vi.fn();
vi.mock("@/auth/server", () => ({
  auth: {
    getSession: mockGetSession,
  },
}));

describe("ensureUserExists", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user row on first login", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "user-1",
      email: "test@example.com",
      displayName: "Test User",
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: "id" })
    );
  });

  it("creates a user_preferences row", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    // Second insert call is for user_preferences
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockPrefsValues).toHaveBeenCalledWith({ userId: "user-1" });
    expect(mockOnConflictDoNothing).toHaveBeenCalledWith({
      target: "user_id",
    });
  });

  it("returns user settings (locale and theme)", async () => {
    mockReturning.mockResolvedValue([
      { id: "user-1", locale: "fr", theme: "dark", xmax: "1" },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toEqual({ locale: "fr", theme: "dark" });
  });

  it("uses onConflictDoUpdate for subsequent logins", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("returns null when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: null });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns null when session has no user", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: {}, user: null },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns null when user has no id", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: null, email: "test@example.com", name: "Test" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns null when user has no email", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: null, name: "Test" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("sets displayName to null when name is not provided", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockValues).toHaveBeenCalledWith({
      id: "user-1",
      email: "test@example.com",
      displayName: null,
    });
  });

  it("sends a welcome email when a new user is created", async () => {
    mockReturning.mockResolvedValue([
      { id: "user-1", locale: "en", theme: "system", xmax: "0" },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    // Invoke the callback captured by after() directly instead of
    // relying on microtask timing
    expect(mockAfter).toHaveBeenCalled();
    const afterCallback = mockAfter.mock.calls[0]![0] as () => Promise<void>;
    await afterCallback();

    expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      name: "Test User",
      userId: "user-1",
    });
  });

  it("does not throw when welcome email fails", async () => {
    mockReturning.mockResolvedValue([
      { id: "user-1", locale: "en", theme: "system", xmax: "0" },
    ]);
    mockSendWelcomeEmail.mockRejectedValue(new Error("Resend API down"));
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toEqual({ locale: "en", theme: "system" });
  });

  it("re-throws when the database upsert fails", async () => {
    mockReturning.mockRejectedValue(new Error("connection refused"));
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Suppress expected error output
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await expect(ensureUserExists()).rejects.toThrow(
      "Failed to initialize user profile"
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to sync user to database:",
      expect.objectContaining({ userId: "user-1" })
    );
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("does not send a welcome email for existing users", async () => {
    mockReturning.mockResolvedValue([
      { id: "user-1", locale: "en", theme: "system", xmax: "1" },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("does not fail when user_preferences insert fails", async () => {
    mockOnConflictDoNothing.mockRejectedValue(new Error("DB error"));
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Suppress expected error output
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toEqual({ locale: "en", theme: "system" });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[ensureUserExists] user_preferences insert failed — non-fatal:",
      expect.objectContaining({ userId: "user-1" })
    );

    consoleSpy.mockRestore();
  });
});

describe("getOrEnsureUserSettings", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached settings from cookie when userId matches (fast path)", async () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: uuid, email: "test@example.com", name: "Test User" },
      },
    });
    mockCookieGet.mockReturnValue({ value: `${uuid}|fr|dark` });

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(result).toEqual({ locale: "fr", theme: "dark" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("falls through to ensureUserExists when no cookie exists (slow path)", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });
    mockCookieGet.mockReturnValue(undefined);

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(result).toEqual({ locale: "en", theme: "system" });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("falls through to ensureUserExists when userId mismatches", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: {
          id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          email: "other@example.com",
          name: "Other",
        },
      },
    });
    mockCookieGet.mockReturnValue({
      value: "a1b2c3d4-e5f6-7890-abcd-ef1234567890|en|system",
    });

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(mockInsert).toHaveBeenCalled();
    expect(result).toEqual({ locale: "en", theme: "system" });
  });

  it("falls through to ensureUserExists when cookie is malformed", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });
    mockCookieGet.mockReturnValue({ value: "garbage" });

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(mockInsert).toHaveBeenCalled();
    expect(result).toEqual({ locale: "en", theme: "system" });
  });

  it("returns null when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: null });

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
