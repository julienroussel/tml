import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/db", () => ({
  getDb: () => ({
    select: mockSelect,
  }),
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "id", bannedAt: "banned_at" },
}));

beforeEach(() => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("isUserBanned", () => {
  it("returns true when bannedAt is set", async () => {
    mockLimit.mockResolvedValue([{ bannedAt: new Date("2026-01-15") }]);
    const { isUserBanned } = await import("./ban-check");

    const result = await isUserBanned("user-123");

    expect(result).toBe(true);
  });

  it("returns false when bannedAt is null", async () => {
    mockLimit.mockResolvedValue([{ bannedAt: null }]);
    const { isUserBanned } = await import("./ban-check");

    const result = await isUserBanned("user-123");

    expect(result).toBe(false);
    expect(mockWhere).toHaveBeenCalledOnce();
  });

  it("returns true when user does not exist (fail-closed)", async () => {
    mockLimit.mockResolvedValue([]);
    const { isUserBanned } = await import("./ban-check");

    const result = await isUserBanned("nonexistent-user");

    expect(result).toBe(true);
  });

  it("returns true when DB query throws (fail-closed)", async () => {
    mockLimit.mockRejectedValue(new Error("connection timeout"));
    const { isUserBanned } = await import("./ban-check");
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await isUserBanned("user-123");

    expect(result).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      "Ban check failed, failing closed:",
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
