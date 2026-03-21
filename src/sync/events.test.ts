import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchSyncError,
  isSyncErrorEvent,
  SYNC_ERROR_EVENT,
  type SyncErrorDetail,
} from "./events";

describe("dispatchSyncError", () => {
  let listener: EventListener;

  afterEach(() => {
    globalThis.removeEventListener(SYNC_ERROR_EVENT, listener);
  });

  it("dispatches a CustomEvent on globalThis with the correct type", () => {
    listener = vi.fn();
    globalThis.addEventListener(SYNC_ERROR_EVENT, listener);

    const detail: SyncErrorDetail = {
      message: "Neon Data API error: 400 Bad Request",
      table: "tricks",
      operation: "PUT",
      status: 400,
      timestamp: 1_710_000_000_000,
    };

    dispatchSyncError(detail);

    expect(listener).toHaveBeenCalledOnce();

    const mock = vi.mocked(listener);
    const event = mock.mock.calls[0]?.[0] as CustomEvent<SyncErrorDetail>;
    expect(event.type).toBe(SYNC_ERROR_EVENT);
    expect(event.detail).toEqual(detail);
  });
});

describe("isSyncErrorEvent", () => {
  it("returns true for a valid sync error CustomEvent", () => {
    const event = new CustomEvent<SyncErrorDetail>(SYNC_ERROR_EVENT, {
      detail: {
        message: "error",
        table: "tricks",
        operation: "PUT",
        status: 400,
        timestamp: Date.now(),
      },
    });
    expect(isSyncErrorEvent(event)).toBe(true);
  });

  it("returns false for a plain Event", () => {
    const event = new Event(SYNC_ERROR_EVENT);
    expect(isSyncErrorEvent(event)).toBe(false);
  });

  it("returns false for a CustomEvent with missing table", () => {
    const event = new CustomEvent(SYNC_ERROR_EVENT, {
      detail: { message: "error" },
    });
    expect(isSyncErrorEvent(event)).toBe(false);
  });
});
