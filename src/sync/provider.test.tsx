import { render, screen } from "@testing-library/react";
import type React from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ObservedStatus } from "./provider";

vi.stubEnv("NEXT_PUBLIC_POWERSYNC_URL", "https://ps.example.com");

// Centralized log-message prefix — change here if the production casing
// shifts, instead of hunting through every assertion.
const LOG_PREFIX = "[powersync]";

const mockConnect = vi.fn(() => Promise.resolve());
const mockDisconnect = vi.fn(() => Promise.resolve());
// Defaults to a promise that never resolves: tests that do not exercise the
// readiness signal then never trigger a post-render setState (no act() noise).
// The readiness test installs a resolving variant via mockImplementationOnce.
const mockWaitForReady = vi.fn(() => new Promise<void>(() => undefined));

// `registerListener` returns a dispose fn the provider must call on unmount.
// Each call produces a fresh dispose so a test can assert that the LATEST
// listener's dispose was invoked (not just any prior one).
const mockDisposes: ReturnType<typeof vi.fn>[] = [];
const registeredListeners: Array<{
  statusChanged?: (status: ObservedStatus) => void;
}> = [];
const mockRegisterListener = vi.fn(
  (listener: { statusChanged?: (status: ObservedStatus) => void }) => {
    registeredListeners.push(listener);
    const dispose = vi.fn();
    mockDisposes.push(dispose);
    return dispose;
  }
);

vi.mock("@powersync/react", () => ({
  PowerSyncContext: {
    Provider: ({ children }: { children: React.ReactNode; value: unknown }) => (
      <div data-testid="powersync-context">{children}</div>
    ),
  },
}));

vi.mock("./system", () => ({
  powerSyncDb: {
    connect: () => mockConnect(),
    disconnect: () => mockDisconnect(),
    waitForReady: () => mockWaitForReady(),
    registerListener: (listener: {
      statusChanged?: (status: ObservedStatus) => void;
    }) => mockRegisterListener(listener),
  },
}));

const mockCreateNeonConnector = vi.fn(
  (_getToken: () => Promise<string | null>) => ({ fetchCredentials: vi.fn() })
);
vi.mock("./connector", () => ({
  createNeonConnector: (getToken: () => Promise<string | null>) =>
    mockCreateNeonConnector(getToken),
}));

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Use beforeEach dynamic import so the module sees NEXT_PUBLIC_POWERSYNC_URL
// already set and avoids top-level await test isolation issues.
type ProviderModule = typeof import("./provider");
let PowerSyncProvider: Awaited<ProviderModule>["PowerSyncProvider"];

describe("PowerSyncProvider", () => {
  beforeEach(async () => {
    // Reset modules so the provider's module-level latches (e.g.
    // `initFailureLatch`) don't leak across tests. Re-stub the env BEFORE the
    // re-import because the provider reads `process.env.NEXT_PUBLIC_POWERSYNC_URL`
    // once at module evaluation; without re-stubbing, every test after the
    // first would take the "URL not set" early-return branch.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_POWERSYNC_URL", "https://ps.example.com");
    const mod = await import("./provider");
    PowerSyncProvider = mod.PowerSyncProvider;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // mockReset (not mockClear) for the three mocks that tests install
    // one-shot impls on via mockImplementationOnce / mockRejectedValueOnce /
    // mockResolvedValueOnce. mockClear leaves queued *Once impls intact and
    // they leak into the next test. Re-install the defaults after reset.
    mockConnect.mockReset().mockImplementation(() => Promise.resolve());
    mockDisconnect.mockReset().mockImplementation(() => Promise.resolve());
    mockWaitForReady
      .mockReset()
      .mockImplementation(() => new Promise<void>(() => undefined));
    mockCreateNeonConnector.mockClear();
    mockRegisterListener.mockClear();
    mockToastError.mockClear();
    mockDisposes.length = 0;
    registeredListeners.length = 0;
  });

  it("renders children", () => {
    render(
      <PowerSyncProvider>
        <span>child content</span>
      </PowerSyncProvider>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("wraps children in PowerSyncContext provider", () => {
    render(
      <PowerSyncProvider>
        <span>wrapped</span>
      </PowerSyncProvider>
    );
    expect(screen.getByTestId("powersync-context")).toBeInTheDocument();
  });

  it("surfaces a toast and logs an error when waitForReady() rejects (WASM init failure)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });
    try {
      mockWaitForReady.mockImplementationOnce(() =>
        Promise.reject(new Error("worker URL unreachable"))
      );

      const { container } = render(
        <PowerSyncProvider>
          <span>test</span>
        </PowerSyncProvider>
      );

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          "PowerSync database initialization failed:",
          expect.any(Error)
        );
      });
      // Assert presence-with-`false` (not absence-of-`true`) so a future
      // refactor that accidentally conditionalizes the span away would fail
      // here instead of silently passing.
      expect(
        container.querySelector('[data-powersync-db-ready="false"]')
      ).not.toBeNull();
      // User-visible recovery prompt. The global next-intl mock returns
      // `${namespace}.${key}` so a namespace-rename regression is caught here.
      expect(mockToastError).toHaveBeenCalledWith("sync.dbInitFailed");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("exposes data-powersync-db-ready once the database initializes", async () => {
    mockWaitForReady.mockImplementationOnce(() => Promise.resolve());

    const { container } = render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    // The gate starts "false": waitForReady()'s resolution is a microtask that
    // has not run yet at this synchronous point right after render().
    expect(
      container.querySelector('[data-powersync-db-ready="false"]')
    ).not.toBeNull();

    // Once waitForReady() resolves it flips to "true" — the form the E2E
    // helper `waitForSyncReady` selects on. See src/sync/provider.tsx.
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-powersync-db-ready="true"]')
      ).not.toBeNull();
    });
  });

  it("disconnects on unmount after successful connection", async () => {
    const { unmount } = render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("registers a statusChanged listener on mount", async () => {
    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(mockRegisterListener).toHaveBeenCalledOnce();
    });
    const listener = registeredListeners[0];
    expect(listener).toBeDefined();
    expect(typeof listener?.statusChanged).toBe("function");
  });

  // Pins the listener-before-connect ordering documented in provider.tsx so
  // the first false→true status transition is captured. A regression that
  // swapped the order would silently lose the "connected" log on first mount.
  it("registers the status listener before calling connect", async () => {
    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );
    await vi.waitFor(() => {
      expect(mockRegisterListener).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
    });
    const listenerOrder = mockRegisterListener.mock.invocationCallOrder[0];
    const connectOrder = mockConnect.mock.invocationCallOrder[0];
    expect(listenerOrder).toBeDefined();
    expect(connectOrder).toBeDefined();
    expect(listenerOrder).toBeLessThan(connectOrder as number);
  });

  it("disposes the status listener on unmount", async () => {
    const { unmount } = render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(mockRegisterListener).toHaveBeenCalledOnce();
    });

    unmount();
    // The dispose fn returned by registerListener is invoked AFTER disconnect
    // resolves (see provider.tsx — disposeListener runs in `.finally(...)`).
    // Async vi.waitFor is required because the dispose lands on a microtask.
    await vi.waitFor(() => {
      expect(mockDisposes[0]).toHaveBeenCalled();
    });
  });

  it("logs key sync-status transitions and avoids re-logging on subsequent ticks", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      // suppress noise in the test runner
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    // false → true: should log "connected".
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    expect(infoSpy).toHaveBeenCalledWith(`${LOG_PREFIX} connected`);
    infoSpy.mockClear();

    // Identical state: must not re-log.
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    expect(infoSpy).not.toHaveBeenCalled();

    // First lastSyncedAt: logs "first sync complete".
    const syncedAt = new Date("2026-05-23T12:00:00Z");
    fireStatusChange({
      connected: true,
      lastSyncedAt: syncedAt,
      dataFlowStatus: {},
    });
    expect(infoSpy).toHaveBeenCalledWith(
      `${LOG_PREFIX} first sync complete`,
      expect.objectContaining({ lastSyncedAt: syncedAt.toISOString() })
    );
    infoSpy.mockClear();

    // Same lastSyncedAt repeated: must not re-log.
    fireStatusChange({
      connected: true,
      lastSyncedAt: syncedAt,
      dataFlowStatus: {},
    });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs disconnected transitions and avoids re-logging on subsequent ticks", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      // suppress
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    // Drive false → true so the next false transition is a real edge.
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    infoSpy.mockClear();

    // true → false: should log "disconnected".
    fireStatusChange({
      connected: false,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    expect(infoSpy).toHaveBeenCalledWith(`${LOG_PREFIX} disconnected`);
    infoSpy.mockClear();

    // Still disconnected: must not re-log.
    fireStatusChange({
      connected: false,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("does not spuriously log 'disconnected' on the first tick when initial state was undefined", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      // suppress
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    // First SDK tick reports connected: false (never-connected baseline).
    // Without the gate fix this would log "disconnected" because undefined
    // !== false. The gate requires prev.connected === true to log disconnect.
    fireStatusChange({
      connected: false,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs an error when disconnect() rejects during cleanup", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress noise
    });
    mockDisconnect.mockImplementationOnce(() =>
      Promise.reject(new Error("forced"))
    );

    const { unmount } = render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    unmount();
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} disconnect failed during cleanup:`,
        expect.any(Error)
      );
    });
  });

  it("logs the first upload error and ignores follow-up ticks with the same error present", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    const uploadErr = new Error("upload failed");
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { uploadError: uploadErr },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      `${LOG_PREFIX} upload error`,
      uploadErr
    );
    errorSpy.mockClear();

    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { uploadError: uploadErr },
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs the first download error and ignores follow-up ticks with the same error present", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress noise
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    const downloadErr = new Error("download failed");
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { downloadError: downloadErr },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      `${LOG_PREFIX} download error`,
      downloadErr
    );
    errorSpy.mockClear();

    // Same error still present: must not spam the console.
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { downloadError: downloadErr },
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("re-logs upload errors after a clear+reappear sequence (dedup gate is edge-triggered, not latched)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    const first = new Error("first");
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { uploadError: first },
    });
    // Clear the error.
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    // New error appears.
    const second = new Error("second");
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { uploadError: second },
    });
    expect(errorSpy).toHaveBeenCalledWith(`${LOG_PREFIX} upload error`, first);
    expect(errorSpy).toHaveBeenCalledWith(`${LOG_PREFIX} upload error`, second);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("re-logs download errors after a clear+reappear sequence", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(registeredListeners.length).toBe(1);
    });
    const fireStatusChange = registeredListeners[0]?.statusChanged;
    if (!fireStatusChange) {
      throw new Error("statusChanged listener was not registered");
    }

    const first = new Error("first");
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { downloadError: first },
    });
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    const second = new Error("second");
    fireStatusChange({
      connected: true,
      lastSyncedAt: undefined,
      dataFlowStatus: { downloadError: second },
    });
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("warns when NEXT_PUBLIC_POWERSYNC_URL is set but never connects (provider gated by env)", () => {
    // Sanity: when URL is set (default for this describe) the env-warn path
    // must NOT fire. Covers the inverse of the missing-URL describe below.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // suppress
    });
    render(
      <PowerSyncProvider>
        <span>x</span>
      </PowerSyncProvider>
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      `${LOG_PREFIX} NEXT_PUBLIC_POWERSYNC_URL is not set — sync disabled`
    );
    warnSpy.mockRestore();
  });

  it("logs error when connection fails", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
      .mockImplementation(() => {});
    mockConnect.mockRejectedValueOnce(new Error("connection failed"));

    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "PowerSync connection failed:",
        expect.any(Error)
      );
    });
  });

  it("passes getToken callback to createNeonConnector", async () => {
    render(
      <PowerSyncProvider>
        <span>test</span>
      </PowerSyncProvider>
    );

    await vi.waitFor(() => {
      expect(mockCreateNeonConnector).toHaveBeenCalledOnce();
    });

    const callback = mockCreateNeonConnector.mock.calls[0]?.[0];
    expect(callback).toBeTypeOf("function");
  });

  describe("getToken (via connector callback)", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Unauthorized", { status: 401 })
      );
    });

    /** Capture the getToken function passed to createNeonConnector. */
    async function captureGetToken(): Promise<() => Promise<string | null>> {
      render(
        <PowerSyncProvider>
          <span>test</span>
        </PowerSyncProvider>
      );

      await vi.waitFor(() => {
        expect(mockCreateNeonConnector).toHaveBeenCalledOnce();
      });

      const callback = mockCreateNeonConnector.mock.calls[0]?.[0];
      if (!callback) {
        throw new Error(
          "createNeonConnector was not called with a getToken callback"
        );
      }
      return callback;
    }

    it("returns the token when fetch responds with a valid token", async () => {
      const getToken = await captureGetToken();

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "test-jwt-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getToken();

      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/token");
      expect(result).toBe("test-jwt-token");
    });

    it("returns null when fetch response is not ok", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );

      const result = await getToken();

      expect(result).toBeNull();
    });

    it("returns null when response JSON has no token field", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ session: "something-else" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getToken();

      expect(result).toBeNull();
    });

    it("returns null when token field is not a string", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 12_345 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await getToken();

      expect(result).toBeNull();
    });

    it("returns null when fetch rejects (network failure)", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new TypeError("Failed to fetch")
      );
      // Network-throw routes through the outer try/catch in provider.tsx and
      // logs a `[powersync] token fetch threw:` error. Asserting the log pins
      // the severity (error, not warn) so a future refactor that downgrades
      // the level would fail here.
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // suppress
      });

      const result = await getToken();
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} token fetch threw:`,
        expect.any(TypeError)
      );
      errorSpy.mockRestore();
    });

    it("logs an error when fetch fails with 5xx status", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );
      // 5xx is a real outage signal; provider.tsx splits severity so 5xx
      // routes to console.error (alerting) while non-401 4xx routes to warn
      // (client misconfiguration). 401 stays silent (expected unauthenticated).
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // suppress console output in test
      });

      const result = await getToken();

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} token fetch failed: 500`
      );
    });

    it("logs a warning when fetch fails with non-401 4xx status", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 })
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        // suppress console output in test
      });

      const result = await getToken();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} token fetch failed: 403`
      );
    });

    it("returns null when response body is not valid JSON", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        })
      );
      // response.json() throws SyntaxError, caught by the outer try/catch in
      // provider.tsx and logged as `[powersync] token fetch threw:`. Asserting
      // the log distinguishes this failure mode from a silent return-null.
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // suppress
      });

      const result = await getToken();

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} token fetch threw:`,
        expect.any(SyntaxError)
      );
      errorSpy.mockRestore();
    });

    it("does not log a warning on 401 (expected unauthenticated)", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        // suppress console output in test
      });

      const result = await getToken();

      expect(result).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

// Stub state is mutated once per describe (beforeAll/afterAll) — never per
// test — so the lifecycle is obvious and not order-sensitive. beforeEach
// only resets the module cache so each test gets a fresh provider import.
describe("PowerSyncProvider — missing NEXT_PUBLIC_POWERSYNC_URL", () => {
  beforeAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(() => {
    vi.stubEnv("NEXT_PUBLIC_POWERSYNC_URL", "https://ps.example.com");
  });

  it("does not connect when NEXT_PUBLIC_POWERSYNC_URL is not set", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // suppress
    });

    const mod = await import("./provider");
    const ProviderWithoutUrl = mod.PowerSyncProvider;

    render(
      <ProviderWithoutUrl>
        <span>test</span>
      </ProviderWithoutUrl>
    );

    // Wait for the env-warn to fire — vi.waitFor polls until the assertion
    // passes, replacing a flake-prone fixed-duration setTimeout. The warn is
    // the deterministic signal that the gated connect-effect has executed.
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} NEXT_PUBLIC_POWERSYNC_URL is not set — sync disabled`
      );
    });

    // mockConnect is still referenced by the re-created mock factory closure
    expect(mockConnect).not.toHaveBeenCalled();
    expect(screen.getByText("test")).toBeInTheDocument();
    warnSpy.mockRestore();
  });
});
