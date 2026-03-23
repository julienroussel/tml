"use client";

import { PowerSyncContext } from "@powersync/react";
import {
  type ReactElement,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
} from "react";
import { authClient } from "@/auth/client";
import { createNeonConnector } from "./connector";
import { powerSyncDb } from "./system";

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;

// Singleton: only one PowerSyncProvider instance should exist in the component tree.
// The powerSyncDb module-level instance is shared across the app to ensure a single
// connection to the PowerSync service.

async function getToken(): Promise<string | null> {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}

interface PowerSyncProviderProps {
  children: ReactNode;
}

export function PowerSyncProvider({
  children,
}: PowerSyncProviderProps): ReactElement {
  const connectedRef = useRef(false);

  useEffect(() => {
    if (connectedRef.current || !POWERSYNC_URL) {
      return;
    }

    let cancelled = false;

    const connectAsync = async (): Promise<void> => {
      try {
        const connector = createNeonConnector(getToken);

        if (cancelled) {
          return;
        }

        await powerSyncDb.connect(connector);

        if (cancelled) {
          powerSyncDb.disconnect();
          return;
        }

        connectedRef.current = true;
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("PowerSync connection failed:", error);
        }
      }
    };

    connectAsync();

    return () => {
      cancelled = true;
      if (connectedRef.current) {
        connectedRef.current = false;
        powerSyncDb.disconnect();
      }
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
