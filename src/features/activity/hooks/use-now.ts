"use client";

import { useEffect, useState } from "react";

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Returns a timestamp that ticks at the given interval. Used by the activity
 * feed so relative-time labels ("2 minutes ago") refresh on quiet pages
 * instead of freezing at the value captured on the last data update.
 *
 * The initial value is `0` so server- and client-rendered HTML match; the
 * first real `Date.now()` is sampled inside the post-mount effect. Consumers
 * should treat `now === 0` as "not yet hydrated"; in practice
 * `<ActivityList />` only renders after PowerSync's loading state clears,
 * which happens after mount.
 */
function useNow(intervalMs: number = DEFAULT_INTERVAL_MS): number {
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}

export { useNow };
