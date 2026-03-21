"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  isSyncErrorEvent,
  SYNC_ERROR_EVENT,
  type SyncErrorDetail,
} from "./events";

/**
 * Headless component that listens for permanent sync upload errors
 * and surfaces them as debounced toast notifications.
 *
 * Errors are buffered for 500ms so a transaction with multiple failed
 * mutations produces a single summary toast, not one per failure.
 */
export function SyncErrorToaster(): ReactElement | null {
  const t = useTranslations("sync");
  const tRef = useRef(t);
  tRef.current = t;
  const bufferRef = useRef<SyncErrorDetail[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleSyncError(event: Event): void {
      if (!isSyncErrorEvent(event)) {
        return;
      }
      bufferRef.current.push(event.detail);

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        const count = bufferRef.current.length;
        if (count > 0) {
          toast.error(tRef.current("mutationDropped", { count }), {
            description: tRef.current("mutationDroppedDescription"),
          });
          bufferRef.current = [];
        }
        timerRef.current = null;
      }, 500);
    }

    globalThis.addEventListener(SYNC_ERROR_EVENT, handleSyncError);

    return () => {
      globalThis.removeEventListener(SYNC_ERROR_EVENT, handleSyncError);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return null;
}
