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

vi.mock("./connector", () => ({
  createNeonConnector: vi.fn(() => ({ fetchCredentials: vi.fn() })),
}));

vi.mock("@/auth/client", () => ({
  authClient: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: { token: "test-token", userId: "user-1" } },
      })
    ),
  },
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
});
