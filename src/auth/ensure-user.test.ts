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
    bannedAt: null,
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
    deletedAt: { name: "deleted_at" },
    bannedAt: "banned_at",
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

const mockLogEventServer = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log-server", () => ({
  logEventServer: (...args: unknown[]) => mockLogEventServer(...args),
}));

const mockReportEventLogFailure = vi.fn();
vi.mock("@/lib/events/report-failure", () => ({
  reportEventLogFailure: (...args: unknown[]) =>
    mockReportEventLogFailure(...args),
}));

const mockGetSession = vi.fn();
vi.mock("@/auth/server", () => ({
  auth: {
    getSession: mockGetSession,
  },
}));

const mockIsUserBanned = vi.fn().mockResolvedValue(false);
vi.mock("@/auth/ban-check", () => ({
  isUserBanned: mockIsUserBanned,
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
      locale: "en",
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: "id" })
    );
  });

  it("seeds locale from NEXT_LOCALE cookie on first login", async () => {
    mockCookieGet.mockReturnValueOnce({ value: "fr" });
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "fr",
        theme: "system",
        bannedAt: null,
        xmax: "0",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "fr" })
    );
  });

  it("falls back to default locale for invalid NEXT_LOCALE cookie", async () => {
    mockCookieGet.mockReturnValueOnce({ value: "zz" });
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" })
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
      { id: "user-1", locale: "fr", theme: "dark", bannedAt: null, xmax: "1" },
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
      locale: "en",
    });
  });

  it("sends a welcome email when a new user is created", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "0",
      },
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
    // calls[0] is the auth.signed_up after(); calls[1] is the welcome email
    const afterCallback = mockAfter.mock.calls[1]![0] as () => Promise<void>;
    await afterCallback();

    expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      name: "Test User",
      userId: "user-1",
      locale: "en",
    });
  });

  it("passes the user locale to the welcome email", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "fr",
        theme: "system",
        bannedAt: null,
        xmax: "0",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockAfter).toHaveBeenCalled();
    // calls[0] is the auth.signed_up after(); calls[1] is the welcome email
    const afterCallback = mockAfter.mock.calls[1]![0] as () => Promise<void>;
    await afterCallback();

    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "fr" })
    );
  });

  it("does not throw when welcome email fails", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "0",
      },
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

    // Invoke the after() callback to exercise the .catch() error handler
    expect(mockAfter).toHaveBeenCalled();
    // calls[0] is the auth.signed_up after(); calls[1] is the welcome email
    const afterCallback = mockAfter.mock.calls[1]![0] as () => Promise<void>;
    await afterCallback();

    expect(mockSendWelcomeEmail).toHaveBeenCalled();
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
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "1",
      },
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

  it("returns null when user is banned", async () => {
    const bannedDate = new Date("2026-03-01T00:00:00Z");
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: bannedDate,
        xmax: "1",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Suppress expected warning output
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[ensureUserExists] Banned user attempted login:",
      expect.objectContaining({ userId: "user-1", bannedAt: bannedDate })
    );
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("does not send welcome email to newly created banned users", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: new Date("2026-03-01T00:00:00Z"),
        xmax: "0",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Suppress expected warning output
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("still creates user_preferences row for banned users", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: new Date("2026-03-01T00:00:00Z"),
        xmax: "1",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Suppress expected warning output
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockPrefsValues).toHaveBeenCalledWith({ userId: "user-1" });

    consoleSpy.mockRestore();
  });

  it("reactivates self-deleted (non-banned) users normally", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "1",
      },
    ]);
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

  it("emits an auth.signed_up event for new users via after()", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "0",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    // auth.signed_up is the FIRST after() callback registered (welcome email is calls[1])
    const afterCallback = mockAfter.mock.calls[0]![0] as () => Promise<void>;
    await afterCallback();

    expect(mockLogEventServer).toHaveBeenCalledTimes(1);
    expect(mockLogEventServer).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      type: "auth.signed_up",
      entityType: "auth",
      entityId: "user-1",
      payload: {},
    });
  });

  it("does NOT emit auth.signed_up for returning users", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "1",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockLogEventServer).not.toHaveBeenCalled();
  });

  it("does NOT emit auth.signed_up for banned users", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: new Date("2026-03-01T00:00:00Z"),
        xmax: "0",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // suppress expected warning
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toBeNull();
    expect(mockLogEventServer).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("still resolves and reports failure when logEventServer rejects", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "user-1",
        locale: "en",
        theme: "system",
        bannedAt: null,
        xmax: "0",
      },
    ]);
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });
    mockLogEventServer.mockRejectedValueOnce(new Error("event log down"));

    const { ensureUserExists } = await import("@/auth/ensure-user");
    const result = await ensureUserExists();

    expect(result).toEqual({ locale: "en", theme: "system" });

    // Flush the after() callback to exercise the .catch() handler
    const afterCallback = mockAfter.mock.calls[0]![0] as () => Promise<void>;
    await afterCallback();

    expect(mockReportEventLogFailure).toHaveBeenCalledTimes(1);
    expect(mockReportEventLogFailure).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        userId: "user-1",
        type: "auth.signed_up",
      })
    );
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

  it("returns null on fast path when user is banned", async () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: uuid, email: "test@example.com", name: "Test User" },
      },
    });
    mockCookieGet.mockReturnValue({ value: `${uuid}|fr|dark` });
    mockIsUserBanned.mockResolvedValue(true);

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(result).toBeNull();
    expect(mockIsUserBanned).toHaveBeenCalledWith(uuid);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns settings on fast path when user is not banned", async () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: uuid, email: "test@example.com", name: "Test User" },
      },
    });
    mockCookieGet.mockReturnValue({ value: `${uuid}|fr|dark` });
    mockIsUserBanned.mockResolvedValue(false);

    const { getOrEnsureUserSettings } = await import("@/auth/ensure-user");
    const result = await getOrEnsureUserSettings();

    expect(result).toEqual({ locale: "fr", theme: "dark" });
    expect(mockIsUserBanned).toHaveBeenCalledWith(uuid);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
