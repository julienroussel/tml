"use client";

import { useStatus } from "@powersync/react";
import { useTranslations } from "next-intl";
import { Component, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBucketHealth } from "@/sync/use-bucket-health";

/**
 * Public contract for `data-sync-state` values. Consumed by E2E helpers in
 * `e2e/helpers.ts` (composed with `FALLBACK_SYNC_STATE` into `SyncState`) —
 * keep this union and the rendered attribute in sync.
 */
export type SyncKey =
  | "offline"
  | "syncing"
  | "pendingChanges"
  | "online"
  | "degraded"
  | "error";

/**
 * Sentinel value emitted on the fallback span. Intentionally not a member of
 * `SyncKey` so locator queries for it never collide with a real state.
 */
export const FALLBACK_SYNC_STATE = "uninitialized";

/** Maps every SyncKey to its dot color — adding a new key without a color is a type error. */
const syncColors: Record<SyncKey, string> = {
  offline: "bg-muted-foreground/40",
  error: "bg-red-500",
  syncing: "bg-blue-500 motion-safe:animate-pulse",
  pendingChanges: "bg-amber-500",
  online: "bg-green-500",
  // `degraded` uses orange to distinguish it from amber/pendingChanges — amber is
  // "writes queued, will resolve itself" while orange is "server returned no buckets,
  // data may be wiped on next sync" (#332). The added ring keeps the two visually
  // distinguishable under red/green color deficiencies where orange and amber
  // collapse to the same hue (WCAG 1.4.1 — text label mitigates at the contract
  // level; ring preserves at-a-glance recognition for a consequence-asymmetric pair).
  degraded: "bg-orange-500 ring-2 ring-foreground/60",
};

function deriveSyncKey(
  status: ReturnType<typeof useStatus>,
  bucketHealth: ReturnType<typeof useBucketHealth>
): SyncKey {
  // Check upload status first — pending local changes take priority over
  // download errors so the user knows their writes haven't synced yet.
  if (status.connected && status.dataFlowStatus.uploading) {
    return "pendingChanges";
  }

  const syncError =
    status.dataFlowStatus.downloadError ?? status.dataFlowStatus.uploadError;

  if (syncError) {
    return "error";
  }
  if (status.connected && status.dataFlowStatus.downloading) {
    return "syncing";
  }
  if (status.connected) {
    // Once a sync cycle has run (lastSyncedAt set — sticky across disconnects
    // per #297, unlike `hasSynced` which resets), surface "degraded" when the
    // server stream subscribes but produces no buckets. That's the silent
    // mode where the WebSocket handshake succeeds, `uploadData` may even be
    // delivering, but downloads return nothing and local writes get wiped
    // on the next confirmation cycle (#332). Gating on `lastSyncedAt`
    // prevents a spurious "degraded" flicker before the first sync attempt.
    //
    // A bucket-health query error is treated the same way as "no buckets":
    // SDK breakage on ps_buckets must NOT escalate to a red "error" pill —
    // that tier is for sync-level errors the user might act on. Staying on
    // degraded keeps the failure visible without crying wolf.
    if (
      status.lastSyncedAt !== undefined &&
      !bucketHealth.isLoading &&
      (bucketHealth.error !== null || !bucketHealth.hasServerBuckets)
    ) {
      return "degraded";
    }
    return "online";
  }
  return "offline";
}

/** Renders an empty placeholder matching the SyncStatus layout dimensions. */
function SyncStatusFallback(): ReactElement {
  return (
    <span
      className="flex items-center gap-1.5"
      data-has-synced="false"
      data-sync-state={FALLBACK_SYNC_STATE}
    />
  );
}

// Error boundary is required here because useStatus() throws if rendered
// outside a PowerSyncContext. A class component is unavoidable — React does
// not provide a functional API for catching render errors.
interface SyncStatusBoundaryState {
  hasError: boolean;
}

class SyncStatusBoundary extends Component<
  { children: ReactNode },
  SyncStatusBoundaryState
> {
  // `hasError` is intentionally NEVER reset. The only currently-expected
  // throw source (rendering `useStatus()` outside `PowerSyncContext`) is
  // permanent for the lifetime of the mount, so flapping the fallback on
  // retry would just thrash. If a transient throw source ever appears
  // (e.g. a future `@powersync/web` upgrade that makes `useBucketHealth`
  // throw on a recoverable condition), wire a `resetKey` prop from the
  // parent — do not add a runtime reset here speculatively.
  override state: SyncStatusBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SyncStatusBoundaryState {
    return { hasError: true };
  }

  // Log unexpected throws. The intended case ("rendered outside
  // PowerSyncContext" from useStatus) is benign and self-evident, but the
  // boundary also covers useBucketHealth — if a future @powersync/web upgrade
  // makes a `ps_buckets` read throw synchronously instead of surfacing via
  // useQuery's `error` field, silent swallowing would erase the breadcrumb.
  override componentDidCatch(error: Error): void {
    console.error("[sync-status] boundary caught render error:", error);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <SyncStatusFallback />;
    }
    return this.props.children;
  }
}

function SyncStatusInner(): ReactElement {
  const status = useStatus();
  const bucketHealth = useBucketHealth();
  const t = useTranslations("sync");

  const key = deriveSyncKey(status, bucketHealth);
  const color = syncColors[key];

  // `lastSyncedAt` (sticky), not `hasSynced` (cleared on every disconnect by
  // @powersync/common's `updateSyncStatus` merge — see issue #297).
  //
  // Intentionally no `role="status"`: PowerSync flaps online/syncing/
  // pendingChanges on every round trip and local write, so a live region
  // would announce each transition to AT users. The pill is an ambient
  // indicator, read on demand like a sighted user glancing at it (#298).
  return (
    <span
      className="flex items-center gap-1.5"
      data-has-synced={status.lastSyncedAt === undefined ? "false" : "true"}
      data-sync-state={key}
    >
      <span
        aria-hidden="true"
        className={cn("inline-flex size-2 rounded-full", color)}
      />
      <span className="text-muted-foreground text-xs">{t(key)}</span>
    </span>
  );
}

export function SyncStatus(): ReactElement {
  return (
    <SyncStatusBoundary>
      <SyncStatusInner />
    </SyncStatusBoundary>
  );
}
