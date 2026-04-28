/**
 * Single chokepoint for reporting failures from the server-side event log
 * sink. Server actions / route handlers fire-and-forget `logEventServer(...)`
 * with `.catch(reportEventLogFailure)` so an event-log outage never breaks
 * the surrounding mutation.
 *
 * We log the Postgres SQLSTATE code (when available) and the error class
 * name only — NOT `error.message` — because event_log payloads contain
 * user-controlled strings (trick / tag / item names) which Postgres echoes
 * verbatim into CHECK / constraint violation messages, and this log is
 * unredacted in Vercel function logs. The entity_pair CHECK violation path
 * exercises this directly.
 *
 * TODO(observability): wire this to Sentry / Logtail. Today it only emits a
 * structured `console.error`; the tagged shape ("[event-log-failure]" plus
 * the context payload) is the seam an observability backend can pattern-match
 * on without further code changes. The structured sink can carry full error
 * detail safely behind PII redaction.
 */
function reportEventLogFailure(
  error: unknown,
  context: { userId: string; type: string }
): void {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  const name = error instanceof Error ? error.constructor.name : typeof error;
  console.error("[event-log-failure]", {
    ...context,
    code,
    name,
  });
}

export { reportEventLogFailure };
