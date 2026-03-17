import { describe, expect, it, vi } from "vitest";

vi.mock("@powersync/web", () => {
  const WASQLiteOpenFactory = vi.fn();
  const PowerSyncDatabase = vi.fn();
  return { WASQLiteOpenFactory, PowerSyncDatabase };
});

vi.mock("./schema", () => ({
  appSchema: { tables: [] },
}));

describe("sync/system", () => {
  it("exports powerSyncDb", async () => {
    const { powerSyncDb } = await import("./system");
    expect(powerSyncDb).toBeDefined();
  });
});
