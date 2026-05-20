"use client";

import { useStatus } from "@powersync/react";
import { useTranslations } from "next-intl";
import { Component, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
};

function deriveSyncKey(status: ReturnType<typeof useStatus>): SyncKey {
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
  override state: SyncStatusBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SyncStatusBoundaryState {
    return { hasError: true };
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
  const t = useTranslations("sync");

  const key = deriveSyncKey(status);
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
      <span className={cn("inline-flex size-2 rounded-full", color)} />
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
