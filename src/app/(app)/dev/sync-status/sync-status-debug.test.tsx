import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Vitest-hoisted mocks so the dynamic `import("./sync-status-debug")` below
// resolves with the mocked PowerSync hooks already in place.
const { mockUseQuery, mockUseStatus, mockUseBucketHealth } = vi.hoisted(() => ({
  mockUseQuery: vi.fn<(sql: string) => unknown>(),
  mockUseStatus: vi.fn(() => ({
    connected: true,
    lastSyncedAt: undefined as Date | undefined,
    dataFlowStatus: {
      uploading: false,
      downloading: false,
      uploadError: undefined as Error | undefined,
      downloadError: undefined as Error | undefined,
    },
  })),
  mockUseBucketHealth: vi.fn(() => ({
    hasServerBuckets: true,
    isLoading: false,
    error: null as Error | null,
  })),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  useStatus: mockUseStatus,
  usePowerSync: vi.fn(),
}));

vi.mock("@/sync/use-bucket-health", () => ({
  useBucketHealth: mockUseBucketHealth,
}));

// Stub global fetch so the JWT-claims effect doesn't crash on a real network
// call when the component mounts. Per-test overrides install specific
// responses.
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("Unauthorized", { status: 401 })
  );

  // Default useQuery: empty result. Tests that need an error or data
  // override on a specific call install per-call returns BEFORE rendering.
  mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  mockUseQuery.mockReset();
});

// Top-level regex constants — Biome/Ultracite forbids defining regexes
// inside test bodies that may run on the hot path (performance/useTopLevelRegex).
const BASE64URL_TRAILING_EQ = /=+$/;
const ENV_POWERSYNC_URL =
  /"NEXT_PUBLIC_POWERSYNC_URL":\s*"https:\/\/ps\.example\.com"|"NEXT_PUBLIC_POWERSYNC_URL":\s*null/;
const ENV_NODE_ENV = /"NODE_ENV":/;

// Helper: load the component fresh so each test sees its own mock setup.
async function loadComponent(): Promise<
  typeof import("./sync-status-debug").SyncStatusDebug
> {
  const mod = await import("./sync-status-debug");
  return mod.SyncStatusDebug;
}

describe("SyncStatusDebug (dev-only diagnostic page)", () => {
  it("renders all five diagnostic sections plus pill state, JWT, and environment", async () => {
    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    // Section titles are h2 — verify all expected operator-facing sections
    // are present so a future refactor that drops a section gets caught.
    expect(
      screen.getByRole("heading", { level: 2, name: "Pill state" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "ps_buckets" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "ps_oplog (total + per bucket)",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "ps_stream_subscriptions" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "ps_crud (pending upload queue)",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "JWT claims (decoded from /api/auth/token)",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Environment" })
    ).toBeInTheDocument();
  });

  it("coalesces oplogTotal.data=undefined to 0 (does not throw on first render)", async () => {
    // Mirrors the `?? []` pattern from use-bucket-health.ts. Without the
    // coalesce, `(undefined)[0]?.count` would throw. With it, the render
    // succeeds and the section displays { total: 0, ... }.
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM ps_oplog") && !sql.includes("GROUP BY")) {
        return { data: undefined, isLoading: true, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    // The oplog section should render with total: 0 (coalesced from
    // undefined) — verify the surrounding JSON contains the expected shape.
    const oplogPre = screen
      .getByRole("heading", { level: 2, name: "ps_oplog (total + per bucket)" })
      .parentElement?.querySelector("pre");
    expect(oplogPre?.textContent).toContain('"total": 0');
  });

  it("coalesces ps_crud data=undefined to 0", async () => {
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM ps_crud")) {
        return { data: undefined, isLoading: true, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    const crudPre = screen
      .getByRole("heading", {
        level: 2,
        name: "ps_crud (pending upload queue)",
      })
      .parentElement?.querySelector("pre");
    expect(crudPre?.textContent).toContain('"pendingOps": 0');
  });

  it("surfaces useQuery errors inline per section rather than crashing the page", async () => {
    // Each query reports SDK breakage via the `error` field. Verify that a
    // `ps_buckets` query failure renders the error message in its section
    // (rather than throwing through the React tree).
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM ps_buckets")) {
        return {
          data: undefined,
          isLoading: false,
          error: new Error("simulated SDK rename"),
        };
      }
      return { data: [], isLoading: false, error: null };
    });

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    const bucketsPre = screen
      .getByRole("heading", { level: 2, name: "ps_buckets" })
      .parentElement?.querySelector("pre");
    expect(bucketsPre?.textContent).toContain("simulated SDK rename");
  });

  it("renders the bucket-health override fields in the Pill state section", async () => {
    mockUseBucketHealth.mockReturnValueOnce({
      hasServerBuckets: false,
      isLoading: false,
      error: new Error("override-active"),
    });

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    const pillPre = screen
      .getByRole("heading", { level: 2, name: "Pill state" })
      .parentElement?.querySelector("pre");
    expect(pillPre?.textContent).toContain('"hasServerBuckets": false');
    expect(pillPre?.textContent).toContain('"error": "override-active"');
  });

  it("renders the JWT fetch-error variant when the token endpoint returns non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    // The discriminated-union switch maps http-error → setJwtError with the
    // status code. Wait for the effect to settle before asserting.
    await waitFor(() => {
      const jwtPre = screen
        .getByRole("heading", {
          level: 2,
          name: "JWT claims (decoded from /api/auth/token)",
        })
        .parentElement?.querySelector("pre");
      expect(jwtPre?.textContent).toContain("HTTP 500");
    });
  });

  it("renders the schema-error variant with the JSON parse error message", async () => {
    // 200 OK + a body that can't be parsed as JSON exercises the
    // `await res.json()` catch path in fetchJwtClaims. The operator-facing
    // message must include the parse error so a diagnostic page user can
    // distinguish "upstream returned HTML" from "upstream returned an
    // incompatible JSON shape".
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<!doctype html>not json", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    await waitFor(() => {
      const jwtPre = screen
        .getByRole("heading", {
          level: 2,
          name: "JWT claims (decoded from /api/auth/token)",
        })
        .parentElement?.querySelector("pre");
      expect(jwtPre?.textContent).toContain(
        "Response from /api/auth/token was not valid JSON"
      );
    });
  });

  it("renders the no-token variant when the response JSON omits the token field", async () => {
    // 200 OK + valid JSON but with no `token` field exercises the
    // `extractToken(data) === null` branch. The operator-facing message
    // tells the operator the upstream contract has drifted (e.g., the
    // route is now returning `{ session: "..." }` without a token).
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ session: "abc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    await waitFor(() => {
      const jwtPre = screen
        .getByRole("heading", {
          level: 2,
          name: "JWT claims (decoded from /api/auth/token)",
        })
        .parentElement?.querySelector("pre");
      expect(jwtPre?.textContent).toContain(
        "Response from /api/auth/token had no `token` field"
      );
    });
  });

  it("renders the network-error variant when fetch rejects with a TypeError", async () => {
    // A `TypeError: Failed to fetch` is the browser's signal for DNS failure,
    // captive portal interception, or a blocked request. The wrapper in
    // fetchJwtClaims maps the throw to `{ kind: "network-error", message }`,
    // and the operator-facing string must include the underlying message so
    // the operator can distinguish those modes.
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new TypeError("Failed to fetch")
    );

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    await waitFor(() => {
      const jwtPre = screen
        .getByRole("heading", {
          level: 2,
          name: "JWT claims (decoded from /api/auth/token)",
        })
        .parentElement?.querySelector("pre");
      expect(jwtPre?.textContent).toContain(
        "Network error fetching /api/auth/token: Failed to fetch"
      );
    });
  });

  it("renders the decode-error variant when the JWT payload is malformed", async () => {
    // `decodeJwtPayload` returns `{ kind: "error", message }` on a malformed
    // token (missing payload segment, non-object payload, atob throw). A
    // two-segment string ("a.b") trips the first guard — `parts[1]` is the
    // base64 "b" which atob accepts, but the resulting JSON parse rejects on
    // the resulting single-byte payload. The rendered text must surface the
    // decode error message so an operator debugging a JWT-trust mismatch
    // sees what specifically broke about the token.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "a.b.c" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    await waitFor(() => {
      const jwtPre = screen
        .getByRole("heading", {
          level: 2,
          name: "JWT claims (decoded from /api/auth/token)",
        })
        .parentElement?.querySelector("pre");
      // The exact message depends on the JS runtime's atob/JSON.parse error
      // text, but the discriminator field is stable. Asserting the `kind`
      // tag pins the decode pathway lands in the error branch without
      // coupling to a specific runtime error string.
      expect(jwtPre?.textContent).toContain('"kind": "error"');
      expect(jwtPre?.textContent).toContain('"message"');
    });
  });

  it("decodes a valid JWT and renders its iss/aud/sub/exp claims", async () => {
    // Construct a minimal three-segment JWT (header.payload.signature).
    // Only the payload is decoded — header/signature contents irrelevant.
    const payload = {
      iss: "https://issuer.example",
      aud: "tml",
      sub: "user-123",
      exp: 1_900_000_000,
    };
    const base64Url = (obj: unknown): string =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(BASE64URL_TRAILING_EQ, "");
    const token = `header.${base64Url(payload)}.signature`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    await waitFor(() => {
      const jwtPre = screen
        .getByRole("heading", {
          level: 2,
          name: "JWT claims (decoded from /api/auth/token)",
        })
        .parentElement?.querySelector("pre");
      // Discriminated-union shape: `{ kind: "claims", claims: { iss, aud, sub, exp } }`.
      // Asserting the `kind` tag pins the success branch as distinct from
      // the `{ kind: "error", message }` variant.
      expect(jwtPre?.textContent).toContain('"kind": "claims"');
      expect(jwtPre?.textContent).toContain('"iss": "https://issuer.example"');
      expect(jwtPre?.textContent).toContain('"sub": "user-123"');
      expect(jwtPre?.textContent).toContain('"exp": 1900000000');
    });
  });

  it("exposes NEXT_PUBLIC_POWERSYNC_URL and NODE_ENV in the Environment section", async () => {
    vi.stubEnv("NEXT_PUBLIC_POWERSYNC_URL", "https://ps.example.com");
    const SyncStatusDebug = await loadComponent();
    render(<SyncStatusDebug />);

    const envPre = screen
      .getByRole("heading", { level: 2, name: "Environment" })
      .parentElement?.querySelector("pre");
    // Note: env var snapshot is captured at module-load time, so this
    // assertion exercises the section's RENDERING, not the live value.
    expect(envPre?.textContent).toMatch(ENV_POWERSYNC_URL);
    expect(envPre?.textContent).toMatch(ENV_NODE_ENV);
    vi.unstubAllEnvs();
  });
});
