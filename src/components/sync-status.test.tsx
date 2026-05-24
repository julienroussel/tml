import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObservedStatus } from "@/sync/provider";
import { SyncStatus } from "./sync-status";

// Derive the mock shape from `ObservedStatus` (the production narrowed type
// — `Pick<SyncStatus, "connected" | "dataFlowStatus" | "lastSyncedAt">`)
// instead of duplicating the key list. If `ObservedStatus` grows in
// provider.tsx, the test surface tracks automatically. The mapped
// `-readonly` modifier strips SyncStatus's readonly getters so tests can
// mutate fields between cases.
type MockStatus = { -readonly [K in keyof ObservedStatus]: ObservedStatus[K] };

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

// Bucket-health stub. Default to "healthy" (has server buckets) so existing
// tests for online/syncing/pendingChanges/error all retain their original
// semantics — the `degraded` branch only triggers when this returns false.
// Mutable singleton intentionally reset per-test via resetStatus(); tests run
// in isolation via beforeEach.
type MockBucketHealth = {
  error: Error | null;
  hasServerBuckets: boolean;
  isLoading: boolean;
};

const DEFAULT_BUCKET_HEALTH: MockBucketHealth = {
  hasServerBuckets: true,
  isLoading: false,
  error: null,
};

const mockBucketHealth: MockBucketHealth = { ...DEFAULT_BUCKET_HEALTH };

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

vi.mock("@/sync/use-bucket-health", () => ({
  useBucketHealth: () => mockBucketHealth,
}));

function resetStatus(): void {
  mockStatus.connected = false;
  mockStatus.lastSyncedAt = undefined;
  mockStatus.dataFlowStatus.uploading = false;
  mockStatus.dataFlowStatus.downloading = false;
  mockStatus.dataFlowStatus.downloadError = undefined;
  mockStatus.dataFlowStatus.uploadError = undefined;
  Object.assign(mockBucketHealth, DEFAULT_BUCKET_HEALTH);
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
    mockStatus.connected = true;
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

  it("renders degraded status when connected and synced but no server buckets exist", () => {
    // Regression guard for #332: pill must not say "online" when the sync
    // stream subscribes but produces no buckets (stale-instance / sync-rules
    // never deployed). `lastSyncedAt` set + `hasServerBuckets=false` is the
    // signature of that silent failure.
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockBucketHealth.hasServerBuckets = false;
    render(<SyncStatus />);

    expect(screen.getByText("sync.degraded")).toBeInTheDocument();
    expect(getPill()).toHaveAttribute("data-sync-state", "degraded");
  });

  it("does not flip to degraded before the first sync attempt (no lastSyncedAt)", () => {
    // Without lastSyncedAt, the bucket count is meaningless — sync hasn't
    // run yet. Showing "degraded" here would flicker on every fresh boot.
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = undefined;
    mockBucketHealth.hasServerBuckets = false;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "online");
  });

  it("does not flip to degraded while bucket-health query is still loading", () => {
    // The hook returns `hasServerBuckets=false` while loading; trusting that
    // before the query resolves would emit a spurious degraded flash.
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockBucketHealth.hasServerBuckets = false;
    mockBucketHealth.isLoading = true;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "online");
  });

  it("prioritizes error over degraded status", () => {
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockStatus.dataFlowStatus.downloadError = new Error("down fail");
    mockBucketHealth.hasServerBuckets = false;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "error");
  });

  it("falls into degraded (not error) when bucket-health query itself errors", () => {
    // Fail-safe contract from use-bucket-health.ts docstring: a SDK-internal
    // failure on the ps_buckets query must NOT escalate to "error" — that
    // tier is reserved for sync-level download/upload errors. Instead the
    // pill degrades so users get an amber hint rather than a red alarm for
    // a diagnostic-tier failure they can't act on.
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockBucketHealth.hasServerBuckets = false;
    mockBucketHealth.error = new Error("ps_buckets table renamed");
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "degraded");
  });

  it("flips to degraded when bucket-health query errors even though buckets are present", () => {
    // Fail-safe contract: a non-null error MUST degrade regardless of the
    // hasServerBuckets value. A regression that swapped `||` to `&&` in
    // deriveSyncKey would let this case pass through to `online`.
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockBucketHealth.hasServerBuckets = true;
    mockBucketHealth.error = new Error("transient SDK issue");
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "degraded");
  });

  it("prioritizes pendingChanges over degraded status", () => {
    // Active upload signal beats degraded — the user's writes are in flight,
    // which is more relevant than the stale-instance hint.
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockStatus.dataFlowStatus.uploading = true;
    mockBucketHealth.hasServerBuckets = false;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "pendingChanges");
  });

  it("prioritizes pendingChanges over a download error", () => {
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.uploading = true;
    mockStatus.dataFlowStatus.downloadError = new Error("download failed");
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "pendingChanges");
  });

  it("prioritizes pendingChanges over its own upload error", () => {
    // The actively-uploading signal beats the previous upload's error: the
    // pill should reflect that another write is in flight, not stay stuck
    // on the most recent failure.
    mockStatus.connected = true;
    mockStatus.dataFlowStatus.uploading = true;
    mockStatus.dataFlowStatus.uploadError = new Error(
      "previous attempt failed"
    );
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "pendingChanges");
  });

  // Priority-chain matrix (#332): pin which key `deriveSyncKey` returns when
  // multiple conditions could match. Mirrors the precedence order in
  // src/components/sync-status.tsx.
  it("prioritizes syncing over degraded when downloading with no server buckets", () => {
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockStatus.dataFlowStatus.downloading = true;
    mockBucketHealth.hasServerBuckets = false;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "syncing");
  });

  it("prioritizes offline over degraded when disconnected with no server buckets", () => {
    mockStatus.connected = false;
    mockStatus.lastSyncedAt = new Date();
    mockBucketHealth.hasServerBuckets = false;
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "offline");
  });

  it("prioritizes sync error over a bucket-health error (error tier > degraded)", () => {
    mockStatus.connected = true;
    mockStatus.lastSyncedAt = new Date();
    mockStatus.dataFlowStatus.downloadError = new Error("download failed");
    mockBucketHealth.hasServerBuckets = false;
    mockBucketHealth.error = new Error("ps_buckets renamed");
    render(<SyncStatus />);

    expect(getPill()).toHaveAttribute("data-sync-state", "error");
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
      // The boundary must log via componentDidCatch — silent swallowing would
      // erase the breadcrumb if a future hook throws for an unexpected reason
      // (e.g. @powersync/web upgrade renames ps_buckets and useBucketHealth
      // starts throwing synchronously).
      expect(errorSpy).toHaveBeenCalledWith(
        "[sync-status] boundary caught render error:",
        expect.any(Error)
      );
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
