import type { useStatus } from "@powersync/react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatus } from "./sync-status";

// Derive the mock shape from the real `useStatus()` return type so the test
// breaks at compile time if @powersync/react renames or retypes a field —
// rather than silently passing against a stale fictional shape. The mapped
// `-readonly` modifier strips SyncStatus's readonly getters so tests can
// mutate fields between cases.
type MockStatus = {
  -readonly [K in "connected" | "dataFlowStatus" | "lastSyncedAt"]: ReturnType<
    typeof useStatus
  >[K];
};

const mockStatus: MockStatus = {
  connected: false,
  lastSyncedAt: undefined,
  dataFlowStatus: {
    uploading: false,
    downloading: false,
    downloadError: undefined,
    uploadError: undefined,
  },
};

// Module-level latch: when true, the next `useStatus()` call throws (simulating
// rendering outside a PowerSyncContext) so SyncStatusBoundary catches it and
// SyncStatusFallback renders. Reset by `resetStatus()` between tests.
let useStatusShouldThrow = false;

vi.mock("@powersync/react", () => ({
  useStatus: () => {
    if (useStatusShouldThrow) {
      throw new Error("useStatus called outside PowerSyncContext");
    }
    return mockStatus;
  },
}));

function resetStatus(): void {
  mockStatus.connected = false;
  mockStatus.lastSyncedAt = undefined;
  mockStatus.dataFlowStatus.uploading = false;
  mockStatus.dataFlowStatus.downloading = false;
  mockStatus.dataFlowStatus.downloadError = undefined;
  mockStatus.dataFlowStatus.uploadError = undefined;
  useStatusShouldThrow = false;
}

/**
 * Locate the SyncStatus pill by its `data-sync-state` public-contract
 * attribute. The pill is intentionally not a live region (no `role="status"`,
 * see #298), so there is no semantic role to query — `data-sync-state` is the
 * same handle the E2E helpers select on.
 */
function getPill(): HTMLElement {
  const pill = document.body.querySelector<HTMLElement>("[data-sync-state]");
  if (!pill) {
    throw new Error("SyncStatus pill not found");
  }
  return pill;
}

describe("SyncStatus", () => {
  beforeEach(() => {
    resetStatus();
  });

  it("renders offline status when disconnected", () => {
    render(<SyncStatus />);

    expect(getPill()).toBeInTheDocument();
    expect(screen.getByText("sync.offline")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "offline");
  });

  it("renders online status when connected with no activity", () => {
    mockStatus.connected = true;
    render(<SyncStatus />);

    expect(screen.getByText("sync.online")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "online");
  });

  it("renders syncing status when connected and downloading", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.downloading = true;
    render(<SyncStatus />);

    expect(screen.getByText("sync.syncing")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "syncing");
  });

  it("renders pendingChanges status when connected and uploading", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.uploading = true;
    render(<SyncStatus />);

    expect(screen.getByText("sync.pendingChanges")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "pendingChanges");
  });

  it("renders error status when there is a download error", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.downloadError = new Error("download failed");
    render(<SyncStatus />);

    expect(screen.getByText("sync.error")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "error");
  });

  it("renders error status when there is an upload error", () => {
    mockStatus.dataFlowStatus.uploadError = new Error("upload failed");
    render(<SyncStatus />);

    expect(screen.getByText("sync.error")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "error");
  });

  it("prioritizes error over syncing status", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.downloading = true;
    mockStatus.dataFlowStatus.downloadError = new Error("fail");
    render(<SyncStatus />);

    expect(screen.getByText("sync.error")).toBeInTheDocument();
  });

  it("reflects lastSyncedAt set via data-has-synced='true'", () => {
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-has-synced", "true");
  });

  it("emits data-has-synced='false' when lastSyncedAt is undefined", () => {
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = undefined;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-has-synced", "false");
  });

  it("keeps data-has-synced='true' after disconnect (lastSyncedAt sticky)", () => {
    // Regression guard for issue #297: PowerSync's updateSyncStatus drops
    // `hasSynced` on disconnect but preserves `lastSyncedAt`. Using
    // lastSyncedAt as the underlying signal keeps the durable latch.
    mockStatus.connected = false;
    mockStatus.lastSyncedAt = new Date();
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-has-synced", "true");
    expect(getPill()).toHaveAttribute("data-sync-state", "offline");
  });

  it("renders fallback with uninitialized state when useStatus throws", () => {
    // Silence React's expected error log for the caught-by-boundary throw.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentionally empty
    });
    try {
      useStatusShouldThrow = true;

      render(<SyncStatus />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(getPill()).toBeInTheDocument();
      expect(getPill()).toHaveAttribute("data-sync-state", "uninitialized");
      expect(getPill()).toHaveAttribute("data-has-synced", "false");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("renders the pill as a presentational badge, not a live region", () => {
    // PowerSync flaps online/syncing/pendingChanges constantly; a live region
    // would announce every transition to AT users. Regression guard for #298.
    mockStatus.connected = true;
    render(<SyncStatus />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const pill = getPill();
    expect(pill).not.toHaveAttribute("role");
    expect(pill).not.toHaveAttribute("aria-live");
  });
});
