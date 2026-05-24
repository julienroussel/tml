"use client";

import { useQuery, useStatus } from "@powersync/react";
import { type ReactElement, useEffect, useId, useState } from "react";
import { hasStringToken } from "@/sync/jwt";
import { useBucketHealth } from "@/sync/use-bucket-health";

// Names of PowerSync internal tables we surface to operators. Read-only diagnostic
// queries. `useQuery` reports SDK breakage (e.g. a renamed `ps_*` table) via its
// `error` field rather than throwing — each section below renders the error inline
// so SDK drift is visible to the operator instead of presenting as empty data.
const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL;

interface BucketRow {
  count_at_last: number;
  count_since_last: number;
  downloaded_size: number;
  last_applied_op: number;
  last_op: number;
  name: string;
}

interface StreamSubscriptionRow {
  active: number;
  is_default: number;
  last_synced_at: number | null;
  local_params: string | null;
  stream_name: string;
}

interface CountRow {
  count: number;
}

interface JwtClaims {
  aud?: string | readonly string[];
  exp?: number;
  iss?: string;
  sub?: string;
}

type DecodedJwt =
  | { kind: "claims"; claims: JwtClaims }
  | { kind: "error"; message: string }
  | null;

type FetchJwtResult =
  | { kind: "ok"; token: string }
  | { kind: "http-error"; status: number }
  | { kind: "schema-error"; message: string }
  | { kind: "no-token" }
  | { kind: "network-error"; message: string };

function extractToken(payload: unknown): string | null {
  return hasStringToken(payload) ? payload.token : null;
}

async function fetchJwtClaims(): Promise<FetchJwtResult> {
  // The declared return type is a closed tagged union — callers rely on the
  // exhaustive switch below. Wrap the fetch so a network throw becomes a
  // `network-error` variant instead of an unhandled rejection.
  let res: Response;
  try {
    res = await fetch("/api/auth/token");
  } catch (err: unknown) {
    return {
      kind: "network-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    return { kind: "http-error", status: res.status };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch (err: unknown) {
    return {
      kind: "schema-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  const token = extractToken(data);
  if (!token) {
    return { kind: "no-token" };
  }
  return { kind: "ok", token };
}

// Display-only decode. No signature verification — the page renders these
// claims inside a <pre> for debugging. NEVER use any returned claim as an
// authorization signal: a future caller doing `if (claims.sub === ADMIN_ID)`
// would be exploitable by anyone able to influence /api/auth/token's response.
function decodeJwtPayload(token: string): DecodedJwt {
  const parts = token.split(".");
  const segment = parts[1];
  if (!segment) {
    return { kind: "error", message: "JWT missing payload segment" };
  }
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const decoded = JSON.parse(atob(padded)) as unknown;
    if (decoded === null || typeof decoded !== "object") {
      return { kind: "error", message: "JWT payload is not a JSON object" };
    }
    const record = decoded as Record<string, unknown>;
    // RFC 7519 §4.1.3: `aud` may be a string OR an array of case-sensitive
    // strings. Some issuers (Auth0/Clerk configurations) emit the array form;
    // dropping it silently would mislead an operator debugging a JWT-trust
    // mismatch — the exact use case this page exists for.
    let aud: string | readonly string[] | undefined;
    if (typeof record.aud === "string") {
      aud = record.aud;
    } else if (
      Array.isArray(record.aud) &&
      record.aud.every((v): v is string => typeof v === "string")
    ) {
      aud = record.aud;
    }
    return {
      kind: "claims",
      claims: {
        iss: typeof record.iss === "string" ? record.iss : undefined,
        aud,
        sub: typeof record.sub === "string" ? record.sub : undefined,
        exp: typeof record.exp === "number" ? record.exp : undefined,
      },
    };
  } catch (err: unknown) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Renders a labeled, scrollable JSON section. Uses `aria-labelledby` pointing
 * at the `<h2>` so screen readers announce the section name once (not twice,
 * which would happen with `aria-label` duplicating the heading text).
 */
function Section({
  data,
  title,
}: {
  data: unknown;
  title: string;
}): ReactElement {
  const titleId = useId();
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <h2 className="mb-2 font-medium text-sm" id={titleId}>
        {title}
      </h2>
      {/* biome-ignore lint/a11y/useSemanticElements: <pre> preserves whitespace for JSON formatting; role="region" + aria-labelledby is the WAI-ARIA APG pattern for an accessible scrollable region. */}
      <pre
        aria-labelledby={titleId}
        className="overflow-x-auto rounded bg-muted p-2 text-xs focus:outline-2 focus:outline-ring focus:outline-offset-2"
        role="region"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region per WAI-ARIA APG — keyboard users need focus to scroll the overflow-x-auto container.
        tabIndex={0}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

export function SyncStatusDebug(): ReactElement {
  const status = useStatus();
  const bucketHealth = useBucketHealth();

  const buckets = useQuery<BucketRow>("SELECT * FROM ps_buckets");
  const oplog = useQuery<CountRow>(
    "SELECT bucket, COUNT(*) AS count FROM ps_oplog GROUP BY bucket"
  );
  const oplogTotal = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM ps_oplog"
  );
  const streamSubs = useQuery<StreamSubscriptionRow>(
    "SELECT * FROM ps_stream_subscriptions"
  );
  const crud = useQuery<CountRow>("SELECT COUNT(*) AS count FROM ps_crud");

  const [jwtClaims, setJwtClaims] = useState<DecodedJwt | "loading">("loading");
  const [jwtError, setJwtError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchJwtClaims()
      .then((result) => {
        if (cancelled) {
          return;
        }
        switch (result.kind) {
          case "ok":
            setJwtClaims(decodeJwtPayload(result.token));
            break;
          case "http-error":
            setJwtError(`HTTP ${result.status} from /api/auth/token`);
            setJwtClaims(null);
            break;
          case "schema-error":
            setJwtError(
              `Response from /api/auth/token was not valid JSON: ${result.message}`
            );
            setJwtClaims(null);
            break;
          case "no-token":
            setJwtError("Response from /api/auth/token had no `token` field");
            setJwtClaims(null);
            break;
          case "network-error":
            setJwtError(
              `Network error fetching /api/auth/token: ${result.message}`
            );
            setJwtClaims(null);
            break;
          default: {
            // Exhaustiveness check: if FetchJwtResult gains a variant, the
            // assignment fails at compile time. The throw guards the runtime
            // case where a type assertion or upstream `as` widening lands an
            // unhandled value here — louder failure mode than a silent fall-
            // through that the outer .catch would log as a generic warn.
            const _exhaustive: never = result;
            throw new Error(
              `Unhandled FetchJwtResult kind: ${JSON.stringify(_exhaustive)}`
            );
          }
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[sync-debug] jwt fetch failed:", err);
        if (!cancelled) {
          setJwtError(message);
          setJwtClaims(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // `data` can be undefined on the first render before the watch resolves;
  // mirror the `data ?? []` coercion used in use-bucket-health.ts so a
  // `data[0]` access never throws.
  const oplogCount = Number((oplogTotal.data ?? [])[0]?.count ?? 0);
  const crudCount = Number((crud.data ?? [])[0]?.count ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Sync diagnostic
        </h1>
        <p className="text-muted-foreground text-sm">
          Dev-only view. Surfaces PowerSync internal state to diagnose silent
          sync failures (issue #332).
        </p>
      </div>

      <Section
        data={{
          connected: status.connected,
          lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
          uploading: status.dataFlowStatus.uploading,
          downloading: status.dataFlowStatus.downloading,
          uploadError: status.dataFlowStatus.uploadError?.message ?? null,
          downloadError: status.dataFlowStatus.downloadError?.message ?? null,
          bucketHealth: {
            hasServerBuckets: bucketHealth.hasServerBuckets,
            isLoading: bucketHealth.isLoading,
            error: bucketHealth.error?.message ?? null,
          },
        }}
        title="Pill state"
      />

      <Section
        data={buckets.error ? { error: buckets.error.message } : buckets.data}
        title="ps_buckets"
      />

      <Section
        data={
          oplogTotal.error || oplog.error
            ? {
                error:
                  oplogTotal.error?.message ?? oplog.error?.message ?? null,
              }
            : { total: oplogCount, perBucket: oplog.data }
        }
        title="ps_oplog (total + per bucket)"
      />

      <Section
        data={
          streamSubs.error
            ? { error: streamSubs.error.message }
            : streamSubs.data
        }
        title="ps_stream_subscriptions"
      />

      <Section
        data={
          crud.error ? { error: crud.error.message } : { pendingOps: crudCount }
        }
        title="ps_crud (pending upload queue)"
      />

      <Section
        data={jwtError ? { fetchError: jwtError } : jwtClaims}
        title="JWT claims (decoded from /api/auth/token)"
      />

      <Section
        data={{
          NEXT_PUBLIC_POWERSYNC_URL: POWERSYNC_URL ?? null,
          NODE_ENV: process.env.NODE_ENV,
        }}
        title="Environment"
      />
    </div>
  );
}
