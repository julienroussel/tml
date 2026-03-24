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

async function getToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/token");
    if (!response.ok) {
      if (response.status !== 401) {
        console.warn(`[PowerSync] Token fetch failed: ${response.status}`);
      }
      return null;
    }
    const data: unknown = await response.json();
    return hasStringToken(data) ? data.token : null;
  } catch {
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
        const connector = createNeonConnector(getToken);
        if (cancelled) {
          return;
        }
        await powerSyncDb.connect(connector);
      } catch (error: unknown) {
        if (!cancelled) {
          connecting = false;
          console.error("PowerSync connection failed:", error);
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
