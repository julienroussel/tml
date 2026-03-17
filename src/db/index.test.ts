import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockDrizzle = vi.fn(() => ({ query: {} }));
const mockNeon = vi.fn(() => vi.fn());

vi.mock("@neondatabase/serverless", () => ({
  neon: mockNeon,
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: mockDrizzle,
}));

vi.mock("./schema", () => ({
  tricks: {},
}));

describe("db/index", () => {
  it("throws when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    globalThis.db = undefined;
    vi.resetModules();

    const { getDb } = await import("./index");
    expect(() => getDb()).toThrow(
      "DATABASE_URL environment variable is required"
    );
  });

  it("creates and returns a database instance", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    globalThis.db = undefined;
    vi.resetModules();

    const { getDb } = await import("./index");
    const db = getDb();
    expect(db).toBeDefined();
    expect(mockNeon).toHaveBeenCalledWith("postgres://localhost/test");
    expect(mockDrizzle).toHaveBeenCalled();
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    globalThis.db = undefined;
    vi.resetModules();

    const { getDb } = await import("./index");
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});
