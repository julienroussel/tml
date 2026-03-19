import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockAfter = vi.fn();
vi.mock("next/server", () => ({
  after: mockAfter,
}));

const mockReturning = vi.fn().mockResolvedValue([
  {
    id: "user-1",
    xmax: "1",
  },
]);
const mockOnConflictDoUpdate = vi.fn(() => ({
  returning: mockReturning,
}));
const mockValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockGetDb = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/db", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id" },
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

  it("returns early when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: null });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns early when session has no user", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: {}, user: null },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns early when user has no id", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: null, email: "test@example.com", name: "Test" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns early when user has no email", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: null, name: "Test" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await ensureUserExists();

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
    mockReturning.mockResolvedValue([{ id: "user-1", xmax: "0" }]);
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
    mockReturning.mockResolvedValue([{ id: "user-1", xmax: "0" }]);
    mockSendWelcomeEmail.mockRejectedValue(new Error("Resend API down"));
    mockGetSession.mockResolvedValue({
      data: {
        session: {},
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
      },
    });

    const { ensureUserExists } = await import("@/auth/ensure-user");
    await expect(ensureUserExists()).resolves.toBeUndefined();
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
    mockReturning.mockResolvedValue([{ id: "user-1", xmax: "1" }]);
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
});
