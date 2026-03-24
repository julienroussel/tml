"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for offline caching.
 *
 * This is separate from push notification setup — the SW handles cache-first
 * static assets (/_next/static/, /@powersync/) and stale-while-revalidate
 * navigation for offline access. Push subscription is managed independently
 * by the PushNotifications component.
 *
 * Mounted in the root layout so the SW is active on all routes.
 */
export function ServiceWorkerRegistration(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = async (): Promise<void> => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error: unknown) {
        console.error("Service worker registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    const handler = (): void => {
      register();
    };
    window.addEventListener("load", handler, { once: true });
    return () => {
      window.removeEventListener("load", handler);
    };
  }, []);

  return null;
}
