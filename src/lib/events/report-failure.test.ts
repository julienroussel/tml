import { describe, expect, it, vi } from "vitest";
import { reportEventLogFailure } from "./report-failure";

describe("reportEventLogFailure", () => {
  it("logs the postgres code when present and never the error message", () => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(
      new Error(
        'violates check constraint payload contains "secret-trick-name"'
      ),
      { code: "23514" }
    );
    reportEventLogFailure(err, {
      userId: "u-1",
      type: "notifications.subscribed",
    });
    expect(spy).toHaveBeenCalledWith(
      "[event-log-failure]",
      expect.objectContaining({
        userId: "u-1",
        type: "notifications.subscribed",
        code: "23514",
      })
    );
    // Critical: the user-controlled trick/tag name in error.message must NOT appear in the logged payload
    const loggedPayload = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(loggedPayload)).not.toContain("secret-trick-name");
    spy.mockRestore();
  });

  it("falls back gracefully when error has no code", () => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportEventLogFailure(new TypeError("oops"), {
      userId: "u-1",
      type: "trick.created",
    });
    expect(spy).toHaveBeenCalledWith(
      "[event-log-failure]",
      expect.objectContaining({
        userId: "u-1",
        type: "trick.created",
        name: "TypeError",
      })
    );
    spy.mockRestore();
  });

  it("handles non-Error throwables", () => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportEventLogFailure("a string", {
      userId: "u-1",
      type: "auth.signed_up",
    });
    expect(spy).toHaveBeenCalledWith(
      "[event-log-failure]",
      expect.objectContaining({
        name: "string",
      })
    );
    spy.mockRestore();
  });
});
