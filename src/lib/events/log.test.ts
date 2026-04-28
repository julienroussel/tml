import type { Transaction } from "@powersync/common";
import { describe, expect, it, vi } from "vitest";
import type { TrickId, UserId } from "@/db/types";
import { logEvent } from "./log";

function fakeTx(): Transaction {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as Transaction;
}

describe("logEvent", () => {
  it("inserts a row with all 9 columns in the documented order", async () => {
    const tx = fakeTx();
    const now = "2026-04-01T12:00:00.000Z";

    await logEvent(tx, {
      userId: "user-1" as UserId,
      type: "trick.created",
      entityType: "trick",
      entityId: "trick-1" as TrickId,
      payload: { name: "Card Warp", status: "new", category: null },
      now,
    });

    expect(tx.execute).toHaveBeenCalledOnce();
    const call = vi.mocked(tx.execute).mock.calls[0];
    expect(call?.[0]).toContain("INSERT INTO event_log");
    const params = call?.[1] as unknown[];
    expect(params).toHaveLength(9);
    expect(typeof params[0]).toBe("string");
    expect(params.slice(1)).toEqual([
      "user-1",
      "trick.created",
      "trick",
      "trick-1",
      JSON.stringify({ name: "Card Warp", status: "new", category: null }),
      "client",
      now,
      now,
    ]);
  });

  it("defaults entityType and entityId to null", async () => {
    const tx = fakeTx();

    await logEvent(tx, {
      userId: "user-1" as UserId,
      type: "settings.theme_changed",
      payload: { theme: "dark" },
    });

    const params = vi.mocked(tx.execute).mock.calls[0]?.[1] as unknown[];
    expect(params[3]).toBeNull();
    expect(params[4]).toBeNull();
  });

  it("source is always 'client'", async () => {
    const tx = fakeTx();

    await logEvent(tx, {
      userId: "user-1" as UserId,
      type: "tag.created",
      payload: { name: "vanish" },
    });

    const params = vi.mocked(tx.execute).mock.calls[0]?.[1] as unknown[];
    expect(params[6]).toBe("client");
  });

  it("uses a fresh ISO timestamp when `now` is omitted", async () => {
    const tx = fakeTx();
    const before = Date.now();

    await logEvent(tx, {
      userId: "user-1" as UserId,
      type: "tag.created",
      payload: { name: "force" },
    });

    const params = vi.mocked(tx.execute).mock.calls[0]?.[1] as unknown[];
    const created = Date.parse(params[7] as string);
    const updated = Date.parse(params[8] as string);
    expect(created).toBe(updated);
    expect(created).toBeGreaterThanOrEqual(before);
  });

  it("serializes payload as JSON string", async () => {
    const tx = fakeTx();

    await logEvent(tx, {
      userId: "user-1" as UserId,
      type: "item.created",
      payload: { name: "Top Hat", type: "prop" },
    });

    const params = vi.mocked(tx.execute).mock.calls[0]?.[1] as unknown[];
    expect(typeof params[5]).toBe("string");
    expect(JSON.parse(params[5] as string)).toEqual({
      name: "Top Hat",
      type: "prop",
    });
  });

  it("propagates tx.execute errors so the surrounding writeTransaction rolls back", async () => {
    const tx = fakeTx();
    vi.mocked(tx.execute).mockRejectedValueOnce(new Error("SQL error"));

    await expect(
      logEvent(tx, {
        userId: "user-1" as UserId,
        type: "trick.created",
        entityType: "trick",
        entityId: "trick-1" as TrickId,
        payload: { name: "n", status: "s", category: null },
      })
    ).rejects.toThrow("SQL error");
  });
});
