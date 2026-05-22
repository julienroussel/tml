"use client";

import { type ReactElement, useEffect, useState } from "react";

interface LoadingAnnouncerProps {
  /**
   * Text to announce, pre-resolved by the caller (e.g. via next-intl). An
   * empty string renders the region silent.
   */
  message: string;
}

/**
 * Polite live-region announcer for a form sheet's loading→ready transition
 * (WCAG 2.2 SC 4.1.3 "Status Messages"; issue #288 F3).
 *
 * Two-tick render: the region mounts with empty content, then `message` is
 * applied on the next commit via an effect. Every announcement — including the
 * first "Loading…" — therefore lands as a DOM mutation on an already-present
 * live region, never as content present at the region's mount. This is the
 * canonically-correct live-region pattern and mitigates issue #295 caveat 1
 * (VoiceOver iOS can swallow content present when a live region is inserted).
 * Mechanism only — confirming VoiceOver iOS actually narrates it still needs a
 * manual screen-reader pass.
 *
 * Render this as a STABLE, unconditionally-mounted sibling of any keyed or
 * conditionally-rendered subtree, so a sibling's remount cannot disturb the
 * region.
 *
 * Remaining known caveats (accepted; issue #295):
 * - Fast hydration: the polite queue may collapse the loading announcement
 *   behind Radix Dialog's `SheetTitle` read. Accepted — hydration is typically
 *   perceptible, and an assertive escape valve would interrupt the title read.
 * - An empty `message` empties the region; most screen readers treat empty
 *   atomic content as silence, a few announce blank. Accepted.
 */
export function LoadingAnnouncer({
  message,
}: LoadingAnnouncerProps): ReactElement {
  const [announced, setAnnounced] = useState("");

  // Two-tick: apply the message only after the empty region has committed, so
  // it registers as a mutation rather than initial content (see the component
  // doc). `requestAnimationFrame` is the escalation knob if a VoiceOver iOS
  // pass shows a single commit is not enough.
  useEffect(() => {
    setAnnounced(message);
  }, [message]);

  return (
    <span
      aria-atomic="true"
      aria-live="polite"
      className="sr-only"
      role="status"
    >
      {announced}
    </span>
  );
}
