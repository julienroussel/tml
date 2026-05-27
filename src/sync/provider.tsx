"use client";

import type { SyncStatus } from "@powersync/common";
import { PowerSyncContext } from "@powersync/react";
import { useTranslations } from "next-intl";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { createNeonConnector } from "./connector";
import { hasStringToken } from "./jwt";
import { powerSyncDb } from "./system";

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;

// Module-scoped latch: ensures each surfaced sync failure toast fires AT MOST
// ONCE per page lifetime, even when an effect re-runs on locale change.
// Without this, a user who hits a permanent failure AND then switches locale
// would see a fresh duplicate toast for each language change (sonner stacks
// by default). Keys: "toasted" = WASM init, "connect" = connect() rejection.
// Using a Set keeps the latch enum-like while staying mutable through const
// (Ultracite would otherwise rewrite a `let` flag back to const).
const initFailureLatch = new Set<"toasted" | "connect">();

interface SyncStatusSnapshot {
  connected: boolean | undefined;
  downloadErrorPresent: boolean;
  hasSyncedOnce: boolean;
  uploadErrorPresent: boolean;
}

// Derived from the SDK type rather than redeclared so a future
// rename or removal of `connected`, `dataFlowStatus`, or `lastSyncedAt` in
// @powersync/common surfaces as a type error here. New fields ADDED to
// SyncStatus are not surfaced — this `Pick` narrows by construction.
export type ObservedStatus = Pick<
  SyncStatus,
  "connected" | "dataFlowStatus" | "lastSyncedAt"
>;

/**
 * Logs only key transitions, not every PowerSync status tick (it flaps on every
 * round-trip and local write). Keeps a console breadcrumb trail that helps
 * diagnose silent-sync failures (#332) without spamming production users.
 *
 * @returns the snapshot reflecting the latest observed status, to be threaded
 *          back as `prev` on the next invocation.
 */
function logStatusTransitions(
  prev: SyncStatusSnapshot,
  status: ObservedStatus
): SyncStatusSnapshot {
  const downloadErrorPresent = Boolean(status.dataFlowStatus.downloadError);
  const uploadErrorPresent = Boolean(status.dataFlowStatus.uploadError);
  const hasSyncedOnce = status.lastSyncedAt !== undefined;

  if (status.connected && prev.connected !== true) {
    console.info("[powersync] connected");
  } else if (!status.connected && prev.connected === true) {
    console.info("[powersync] disconnected");
  }
  if (downloadErrorPresent && !prev.downloadErrorPresent) {
    console.error(
      "[powersync] download error",
      status.dataFlowStatus.downloadError
    );
  }
  if (uploadErrorPresent && !prev.uploadErrorPresent) {
    console.error(
      "[powersync] upload error",
      status.dataFlowStatus.uploadError
    );
  }
  if (hasSyncedOnce && !prev.hasSyncedOnce) {
    console.info("[powersync] first sync complete", {
      lastSyncedAt: status.lastSyncedAt?.toISOString(),
    });
  }

  return {
    connected: status.connected,
    hasSyncedOnce,
    downloadErrorPresent,
    uploadErrorPresent,
  };
}

// Singleton: only one PowerSyncProvider instance should exist in the component tree.
// The powerSyncDb module-level instance is shared across the app to ensure a single
// connection to the PowerSync service. The provider itself lives inside the (app)
// layout — sign-out leaves that layout, so the provider unmounts and `snapshot`
// in the connect effect resets. A subsequent sign-in re-mounts and logs
// "first sync complete" again. Don't move the provider above the auth boundary
// unless you also rework the per-mount snapshot semantics in
// logStatusTransitions.

async function getToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/token");
    if (!response.ok) {
      // Severity split:
      //   401          → expected unauthenticated path; no log (user just hasn't signed in).
      //   other 4xx    → client misconfiguration; warn.
      //   5xx          → server problem worth alerting on; error.
      // Keeps Vercel log filters / APM alerts gated on `error` level from
      // missing real outages while not crying wolf on normal 401s.
      if (response.status !== 401) {
        if (response.status >= 500) {
          console.error(`[powersync] token fetch failed: ${response.status}`);
        } else {
          console.warn(`[powersync] token fetch failed: ${response.status}`);
        }
      }
      return null;
    }
    const data: unknown = await response.json();
    if (!hasStringToken(data)) {
      // Schema regression on /api/auth/token (e.g. renamed field, breaking
      // change in Neon Auth). HTTP succeeded and JSON parsed, so the catch
      // arm below never sees this — explicit branch restores the breadcrumb
      // a silent shape drift would otherwise erase.
      console.error("[powersync] token endpoint returned unexpected shape");
      return null;
    }
    return data.token;
  } catch (error: unknown) {
    // Network throw or JSON parse failure is a sustained failure mode
    // (DNS down, captive portal, JSON-shape regression on the API).
    console.error("[powersync] token fetch threw:", error);
    // null = "no auth available"; intentionally same return as the 401/empty-token
    // paths so the connector applies one retry policy. If retry semantics ever
    // diverge, return a tagged union.
    return null;
  }
}

interface PowerSyncProviderProps {
  children: ReactNode;
}

export function PowerSyncProvider({
  children,
}: PowerSyncProviderProps): ReactElement {
  const [dbReady, setDbReady] = useState(false);
  const t = useTranslations("sync");
  // The WASM-readiness effect must run once per mount, not on every locale
  // change. `t` changes identity when the user switches language; routing it
  // through a ref lets the effect read the current translator without listing
  // `t` in its deps. `tRef.current` is read inside the `.catch` arm only.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!POWERSYNC_URL) {
      console.warn(
        "[powersync] NEXT_PUBLIC_POWERSYNC_URL is not set — sync disabled"
      );
      return;
    }
    // Listener-then-connect ordering matters; see the comment block above
    // the registerListener call below for the rationale.

    let cancelled = false;

    // Connect/disconnect on each mount; StrictMode double-mount is intentional.
    // The previous code held a module-level `connecting` guard to serialize
    // mounts — removed because `@powersync/common`'s ConnectionManager already
    // dedupes via `connectingPromise`/`disconnectingPromise` and handles the
    // connect-while-disconnecting race via `pendingConnectionOptions` + a
    // sanity disconnect at the start of `connectInternal()` (see
    // node_modules/@powersync/common/lib/client/ConnectionManager.js:64-154).
    // Verified against @powersync/common@1.53.2. If you bump that package,
    // re-verify ConnectionManager still serializes concurrent connect/disconnect
    // calls; if it doesn't, restore the module-level `connecting` guard.
    // Register a status listener BEFORE connecting so the first transition
    // (false → true on success, or false → false with errors on failure)
    // is captured. `registerListener` returns a dispose fn; called in cleanup.
    let snapshot: SyncStatusSnapshot = {
      connected: undefined,
      hasSyncedOnce: false,
      downloadErrorPresent: false,
      uploadErrorPresent: false,
    };
    const disposeListener = powerSyncDb.registerListener({
      statusChanged: (status: ObservedStatus) => {
        if (cancelled) {
          return;
        }
        snapshot = logStatusTransitions(snapshot, status);
      },
    });

    const connectAsync = async (): Promise<void> => {
      try {
        const connector = createNeonConnector(getToken);
        if (cancelled) {
          return;
        }
        await powerSyncDb.connect(connector);
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("PowerSync connection failed:", error);
          // Mirror the WASM-init toast latch: surface a one-time user-visible
          // signal so a permanent connect failure (bad config, JWT trust
          // mismatch) isn't conflated with a normal offline state in the
          // SyncStatus pill. Connector retries continue in the background;
          // the toast is informational, not a blocking prompt.
          if (!initFailureLatch.has("connect")) {
            initFailureLatch.add("connect");
            toast.error(tRef.current("connectFailed"));
          }
        }
      }
    };

    // Defensive: if a future refactor removes the inner try/catch (or replaces
    // async with a sync wrapper), this prevents an unhandled rejection from
    // escaping the effect.
    connectAsync().catch((err: unknown) => {
      console.error("[powersync] connect dispatch failed:", err);
    });

    return () => {
      cancelled = true;
      // `.finally()` guarantees `disposeListener()` runs even if `disconnect()`
      // rejects, preserving the always-dispose contract. The drain-time
      // statusChanged events emitted between `cancelled = true` and the
      // disconnect resolution DO reach the listener but are short-circuited
      // by the `if (cancelled) return` guard inside `statusChanged` — that
      // guard is the authoritative drop-point for late events. This ordering
      // is purely a defensive lifetime guarantee against a wedged disconnect
      // leaking the listener; it does NOT route drain events through
      // `logStatusTransitions`.
      // Cleanup is fire-and-forget; a wedged disconnect leaves the singleton in
      // indeterminate state until next mount or page reload. Acceptable today
      // (ConnectionManager dedupes via pendingConnectionOptions per
      // @powersync/common 1.53.2).
      powerSyncDb
        .disconnect()
        .catch((err: unknown) => {
          console.error("[powersync] disconnect failed during cleanup:", err);
        })
        .finally(() => {
          disposeListener();
        });
    };
  }, []);

  // Track WASQLite readiness. The PowerSyncDatabase constructor auto-runs
  // initialize() — spawn the worker, importScripts the wa-sqlite chunk, load
  // and compile the WASM, apply the schema — and waitForReady() resolves once
  // that completes. Surfaced as `data-powersync-db-ready` so E2E tests can gate
  // on a genuine "local SQLite is open" signal before dropping the network
  // (see `waitForSyncReady` in e2e/helpers.ts). A real user never observes the
  // loading window — this span is invisible, purely a test-observability hook.
  useEffect(() => {
    let cancelled = false;
    powerSyncDb
      .waitForReady()
      .then(() => {
        if (!cancelled) {
          setDbReady(true);
        }
      })
      .catch((error: unknown) => {
        // Initialization failed (worker/WASM unreachable, schema error).
        // Leave the signal false so a readiness gate fails loudly instead of
        // a test silently proceeding against an unopened database. The E2E
        // gate depends on `dbReady` staying false — see `data-powersync-db-ready`.
        console.error("PowerSync database initialization failed:", error);
        // Surface a one-time user-visible error so an offline-first failure
        // doesn't leave the app silently broken with no signal. Reload is
        // the only recovery path: the WASM init cannot be retried in-place
        // (the worker is dead). The module-level `initFailureLatch` Set
        // additionally guards against StrictMode double-mount and a future
        // refactor that re-introduces a dep that re-fires this effect.
        if (!initFailureLatch.has("toasted")) {
          initFailureLatch.add("toasted");
          toast.error(tRef.current("dbInitFailed"));
        }
      });
    return () => {
      cancelled = true;
    };
    // Mount-once: deps are `[]` (not `[t]`). `t` is read via `tRef.current`
    // in the catch arm so a locale switch does NOT re-invoke waitForReady()
    // — it's the same Promise; re-awaiting it would do nothing in the
    // success path and produce a redundant catch fire-and-suppression
    // cycle on permanent WASM failures.
  }, []);

  return (
    <>
      <span data-powersync-db-ready={dbReady ? "true" : "false"} hidden />
      <PowerSyncContext.Provider value={powerSyncDb}>
        {children}
      </PowerSyncContext.Provider>
    </>
  );
}
