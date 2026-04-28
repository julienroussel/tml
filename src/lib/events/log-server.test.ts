import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Database } from "@/db";
import { eventLog } from "@/db/schema/event-log";
import type { UserId } from "@/db/types";
import { logEventServer } from "./log-server";

function fakeDb(): {
  db: Database;
  values: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
} {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  const db = { insert } as unknown as Database;
  return { db, values, insert };
}

describe("logEventServer", () => {
  it("inserts into the event_log table with source='server'", async () => {
    const { db, values, insert } = fakeDb();

    await logEventServer(db, {
      userId: "user-1" as UserId,
      type: "auth.signed_up",
      payload: {},
    });

    expect(insert).toHaveBeenCalledWith(eventLog);
    expect(values).toHaveBeenCalledOnce();
    expect(values.mock.calls[0]?.[0]).toMatchObject({
      userId: "user-1",
      eventType: "auth.signed_up",
      payload: {},
      source: "server",
      entityType: null,
      entityId: null,
    });
  });

  it("forwards entityType and entityId when provided", async () => {
    const { db, values } = fakeDb();

    await logEventServer(db, {
      userId: "user-1" as UserId,
      type: "settings.theme_changed",
      payload: { theme: "dark" },
      entityType: "settings",
      entityId: "user-1" as UserId,
    });

    expect(values.mock.calls[0]?.[0]).toMatchObject({
      entityType: "settings",
      entityId: "user-1",
      payload: { theme: "dark" },
    });
  });
});
