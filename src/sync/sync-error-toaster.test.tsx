import { cleanup, render } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYNC_ERROR_EVENT, type SyncErrorDetail } from "./events";
import { SyncErrorToaster } from "./sync-error-toaster";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function dispatchError(overrides?: Partial<SyncErrorDetail>): void {
  const detail: SyncErrorDetail = {
    message: "Neon Data API error: 400 Bad Request",
    table: "tricks",
    operation: "PUT",
    status: 400,
    timestamp: Date.now(),
    ...overrides,
  };
  globalThis.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail }));
}

describe("SyncErrorToaster", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it("shows a toast after the debounce window", () => {
    render(<SyncErrorToaster />);

    dispatchError();
    expect(toast.error).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith(
      "sync.mutationDropped (count: 1)",
      { description: "sync.mutationDroppedDescription" }
    );
  });

  it("debounces multiple errors into a single toast", () => {
    render(<SyncErrorToaster />);

    dispatchError({ table: "tricks" });
    dispatchError({ table: "setlists" });
    dispatchError({ table: "items" });

    vi.advanceTimersByTime(500);
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith(
      "sync.mutationDropped (count: 3)",
      { description: "sync.mutationDroppedDescription" }
    );
  });

  it("clears the buffer after showing the toast", () => {
    render(<SyncErrorToaster />);

    dispatchError();
    vi.advanceTimersByTime(500);
    expect(toast.error).toHaveBeenCalledOnce();

    // Second batch
    dispatchError();
    vi.advanceTimersByTime(500);
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenLastCalledWith(
      "sync.mutationDropped (count: 1)",
      { description: "sync.mutationDroppedDescription" }
    );
  });

  it("does not show a toast after unmounting", () => {
    const { unmount } = render(<SyncErrorToaster />);

    dispatchError();
    unmount();

    vi.advanceTimersByTime(500);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("resets the debounce timer on each new event", () => {
    render(<SyncErrorToaster />);

    dispatchError();
    vi.advanceTimersByTime(400);
    expect(toast.error).not.toHaveBeenCalled();

    dispatchError();
    vi.advanceTimersByTime(400);
    expect(toast.error).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith(
      "sync.mutationDropped (count: 2)",
      { description: "sync.mutationDroppedDescription" }
    );
  });

  it("renders nothing", () => {
    const { container } = render(<SyncErrorToaster />);
    expect(container.innerHTML).toBe("");
  });
});
