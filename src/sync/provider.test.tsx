import { render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_POWERSYNC_URL", "https://ps.example.com");

const mockConnect = vi.fn(() => Promise.resolve());
const mockDisconnect = vi.fn();

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
  },
}));

const mockCreateNeonConnector = vi.fn(
  (_getToken: () => Promise<string | null>) => ({ fetchCredentials: vi.fn() })
);
vi.mock("./connector", () => ({
  createNeonConnector: (getToken: () => Promise<string | null>) =>
    mockCreateNeonConnector(getToken),
}));

// Use beforeEach dynamic import so the module sees NEXT_PUBLIC_POWERSYNC_URL
// already set and avoids top-level await test isolation issues.
type ProviderModule = typeof import("./provider");
let PowerSyncProvider: Awaited<ProviderModule>["PowerSyncProvider"];

describe("PowerSyncProvider", () => {
  beforeEach(async () => {
    const mod = await import("./provider");
    PowerSyncProvider = mod.PowerSyncProvider;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockCreateNeonConnector.mockClear();
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

      const result = await getToken();
      expect(result).toBeNull();
    });

    it("logs a warning when fetch fails with non-401 status", async () => {
      const getToken = await captureGetToken();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        // suppress console output in test
      });

      const result = await getToken();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        "[PowerSync] Token fetch failed: 500"
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

      const result = await getToken();

      expect(result).toBeNull();
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

  // This test must be last: vi.resetModules() invalidates mock references
  // used by other tests, so no tests should run after it.
  it("does not connect when NEXT_PUBLIC_POWERSYNC_URL is not set", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();

    const mod = await import("./provider");
    const ProviderWithoutUrl = mod.PowerSyncProvider;

    render(
      <ProviderWithoutUrl>
        <span>test</span>
      </ProviderWithoutUrl>
    );

    // Allow any pending async work to flush
    await new Promise((resolve) => setTimeout(resolve, 100));

    // mockConnect is still referenced by the re-created mock factory closure
    expect(mockConnect).not.toHaveBeenCalled();
    expect(screen.getByText("test")).toBeInTheDocument();
  });
});
