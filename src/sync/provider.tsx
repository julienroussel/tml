"use client";

import { PowerSyncContext } from "@powersync/react";
import { type ReactElement, type ReactNode, Suspense, useEffect } from "react";
import { createNeonConnector } from "./connector";
import { powerSyncDb } from "./system";

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;

// Singleton: only one PowerSyncProvider instance should exist in the component tree.
// The powerSyncDb module-level instance is shared across the app to ensure a single
// connection to the PowerSync service.

function hasStringToken(value: unknown): value is { token: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "token" in value &&
    typeof value.token === "string"
  );
}

// DIAG #300 — REVERT BEFORE MERGE. Widened logging to surface why
// /api/auth/token doesn't yield a usable token on Vercel previews.
async function getToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/token");
    // DIAG #300: stamp the token response status onto <html> so Playwright
    // can read it without needing Vercel log access.
    document.documentElement.setAttribute(
      "data-diag-token-status",
      String(response.status)
    );
    console.info("[DIAG #300] /api/auth/token response", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      url: response.url,
      cookieSent: document.cookie.length > 0,
    });
    if (!response.ok) {
      if (response.status !== 401) {
        console.warn(`[PowerSync] Token fetch failed: ${response.status}`);
        console.warn(
          "[DIAG #300] returning null — non-OK status",
          response.status
        );
      }
      document.documentElement.setAttribute("data-diag-token-ok", "false");
      return null;
    }
    const data: unknown = await response.json();
    const tokenOk = hasStringToken(data);
    document.documentElement.setAttribute(
      "data-diag-token-ok",
      tokenOk ? "true" : "false-bad-shape"
    );
    console.info("[DIAG #300] token body shape", {
      tokenOk,
      keys: data && typeof data === "object" ? Object.keys(data) : null,
    });
    return tokenOk ? data.token : null;
  } catch (err) {
    console.error("[DIAG #300] getToken threw", err);
    return null;
  }
}

interface PowerSyncProviderProps {
  children: ReactNode;
}

// Module-level flag: survives React strict mode double-mount in development.
// The powerSyncDb singleton must be connected at most once — this flag
// prevents the cleanup/remount cycle from creating a race condition where
// a stale connect() resolution disconnects an active connection.
let connecting = false;

export function PowerSyncProvider({
  children,
}: PowerSyncProviderProps): ReactElement {
  useEffect(() => {
    if (connecting || !POWERSYNC_URL) {
      return;
    }
    connecting = true;

    let cancelled = false;

    const connectAsync = async (): Promise<void> => {
      try {
        // DIAG #300 — wrap getToken so we can see whether fetchCredentials
        // is even being invoked on previews.
        const wrappedGetToken = async (): Promise<string | null> => {
          console.info("[DIAG #300] fetchCredentials -> getToken invoked");
          const t = await getToken();
          console.info("[DIAG #300] getToken resolved", {
            hasToken: t !== null,
          });
          return t;
        };
        const connector = createNeonConnector(wrappedGetToken);
        if (cancelled) {
          return;
        }
        console.info("[DIAG #300] powerSyncDb.connect() starting");
        await powerSyncDb.connect(connector);
        console.info("[DIAG #300] powerSyncDb.connect() resolved");
      } catch (error: unknown) {
        if (!cancelled) {
          connecting = false;
          console.error("PowerSync connection failed:", error);
          console.error("[DIAG #300] connect threw", error);
        }
      }
    };

    connectAsync();

    return () => {
      cancelled = true;
      connecting = false;
      powerSyncDb.disconnect();
    };
  }, []);

  return (
    <Suspense fallback={null}>
      <PowerSyncContext.Provider value={powerSyncDb}>
        {children}
      </PowerSyncContext.Provider>
    </Suspense>
  );
}
