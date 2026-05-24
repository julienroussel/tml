import type { useStatus } from "@powersync/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Type the useStatus mock from the SDK so a `@powersync/react` rename or
// retype breaks this file at compile time instead of silently passing
// against a stale fictional shape. Matches the discipline used in
// sync-status.test.tsx.
type SyncStatusReturn = ReturnType<typeof useStatus>;

const { mockUseQuery, mockUseStatus } = vi.hoisted(() => ({
  mockUseQuery: vi.fn<(sql: string) => unknown>(),
  mockUseStatus: vi.fn<() => Partial<ReturnType<typeof useStatus>>>(() => ({
    connected: true,
  })),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  useStatus: mockUseStatus,
  usePowerSync: vi.fn(),
}));

import { clearGlobalOverride, writeGlobalOverride } from "./test-override-key";
import {
  __resetLoggedBucketHealthErrorsForTests,
  useBucketHealth,
} from "./use-bucket-health";

// Module-level error dedup keyed by `error.message` lives in use-bucket-health
// for the page's lifetime. The hook exposes a test-only reset helper
// (`__resetLoggedBucketHealthErrorsForTests`) so we can verify the keying
// contract directly. For tests that just need to avoid cross-test collisions
// without exercising the keying claim, `uniqueErrorMessage()` keeps the Set
// keys disjoint across cases AND across vitest watch-mode re-runs.
function uniqueErrorMessage(label: string): string {
  return `${label}-${Math.random()}`;
}

/**
 * Cast helper for fully-shaped useStatus return values. The SDK's SyncStatus
 * has dozens of readonly fields we don't care about in the hook (which reads
 * only `connected`); the cast acknowledges the partial-shape mock contract.
 */
function statusReturn(value: { connected: boolean }): SyncStatusReturn {
  return value as SyncStatusReturn;
}

describe("useBucketHealth hook", () => {
  beforeEach(() => {
    // Centralized mock reset — replaces defensive mockClear() calls scattered
    // across individual tests. Re-establish the default useStatus return so
    // tests that don't explicitly override it see the connected path.
    mockUseQuery.mockReset();
    mockUseStatus.mockReset();
    mockUseStatus.mockReturnValue(statusReturn({ connected: true }));
  });

  it("reports hasServerBuckets=false when only the $local placeholder exists", () => {
    mockUseQuery.mockReturnValue({
      data: [{ count: 0 }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useBucketHealth());
    expect(result.current.hasServerBuckets).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports hasServerBuckets=true when at least one non-$local bucket row exists", () => {
    mockUseQuery.mockReturnValue({
      data: [{ count: 1 }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useBucketHealth());
    expect(result.current.hasServerBuckets).toBe(true);
  });

  it("reports hasServerBuckets=false when the query returns no rows yet", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true, error: null });
    const { result } = renderHook(() => useBucketHealth());
    expect(result.current.hasServerBuckets).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("coerces string counts to numbers (SQLite driver edge case)", () => {
    mockUseQuery.mockReturnValue({
      data: [{ count: "3" }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useBucketHealth());
    expect(result.current.hasServerBuckets).toBe(true);
  });

  it("surfaces useQuery error and normalizes undefined to null", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress expected first-error log emitted by the hook's useEffect
    });
    try {
      const err = new Error(uniqueErrorMessage("query failed"));
      mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
      expect(renderHook(() => useBucketHealth()).result.current.error).toBe(
        err
      );

      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: undefined,
      });
      expect(
        renderHook(() => useBucketHealth()).result.current.error
      ).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe("readTestOverride (production gate)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      clearGlobalOverride();
    });

    it("honors the window override outside production (E2E hook path)", () => {
      vi.stubEnv("NODE_ENV", "development");
      mockUseQuery.mockReturnValue({
        data: [{ count: 5 }],
        isLoading: false,
        error: null,
      });
      writeGlobalOverride({
        hasServerBuckets: false,
        isLoading: false,
        error: null,
      });
      const { result } = renderHook(() => useBucketHealth());
      // Override wins over the live useQuery result.
      expect(result.current.hasServerBuckets).toBe(false);
    });

    it("ignores the window override in production (live query wins)", () => {
      vi.stubEnv("NODE_ENV", "production");
      mockUseQuery.mockReturnValue({
        data: [{ count: 5 }],
        isLoading: false,
        error: null,
      });
      writeGlobalOverride({
        hasServerBuckets: false,
        isLoading: false,
        error: null,
      });
      const { result } = renderHook(() => useBucketHealth());
      // Production gate: override is ignored, useQuery result is returned.
      expect(result.current.hasServerBuckets).toBe(true);
    });

    it("ignores a non-object override value and falls back to the live query", () => {
      vi.stubEnv("NODE_ENV", "development");
      mockUseQuery.mockReturnValue({
        data: [{ count: 7 }],
        isLoading: false,
        error: null,
      });
      writeGlobalOverride("not-an-object");
      const { result } = renderHook(() => useBucketHealth());
      expect(result.current.hasServerBuckets).toBe(true);
    });
  });

  // Tripwire: ps_buckets is a private PowerSync SDK table. If this assertion
  // breaks during an @powersync/web bump, audit the SDK changelog before
  // "fixing" the test — the breakage is meaningful signal, not noise.
  it("issues a COUNT query against ps_buckets filtered to non-$local rows", () => {
    mockUseQuery.mockReturnValue({
      data: [{ count: 0 }],
      isLoading: false,
      error: null,
    });
    renderHook(() => useBucketHealth());

    const sql = mockUseQuery.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).toContain("SELECT COUNT(*)");
    expect(sql).toContain("FROM ps_buckets");
    expect(sql).toContain("name != '$local'");
  });

  it("swaps to a no-op query when useStatus reports disconnected", () => {
    // mockReturnValue (not Once) so every render in this case — including a
    // future StrictMode-double-render or vitest re-mount — sees the
    // disconnected state. Using Once would silently flip the SECOND render
    // back to connected:true (from beforeEach's default), making the
    // mock.calls[0] assertion accidentally depend on render count.
    mockUseStatus.mockReturnValue({ connected: false });
    mockUseQuery.mockReturnValue({
      data: [{ count: 0 }],
      isLoading: false,
      error: null,
    });
    renderHook(() => useBucketHealth());
    const sql = mockUseQuery.mock.calls[0]?.[0];
    expect(typeof sql).toBe("string");
    expect(sql).not.toContain("ps_buckets");
    expect(sql).toContain("LIMIT 0");
  });

  it("swaps back to the ps_buckets query when useStatus reports reconnected", () => {
    // Regression guard for the user-visible "data syncs after coming back
    // online" path. The disconnected case is exercised above; this case
    // pins that the SQL FLIPS BACK to the live ps_buckets watch on the
    // next render after `connected` transitions to true. Without this
    // test, a regression that hardcoded the no-op SQL would pass.
    mockUseStatus.mockReturnValue({ connected: false });
    mockUseQuery.mockReturnValue({
      data: [{ count: 0 }],
      isLoading: false,
      error: null,
    });
    const { rerender } = renderHook(() => useBucketHealth());
    expect(mockUseQuery.mock.calls[0]?.[0]).toContain("LIMIT 0");

    mockUseStatus.mockReturnValue({ connected: true });
    rerender();
    const reconnectSql = mockUseQuery.mock.calls.at(-1)?.[0];
    expect(typeof reconnectSql).toBe("string");
    expect(reconnectSql).toContain("ps_buckets");
    expect(reconnectSql).toContain("name != '$local'");

    // Stability check: another rerender with the same connected state must
    // produce the SAME SQL string. The hook documents that each flip
    // re-prepares the watch — pin that the steady-state DOES NOT thrash.
    const beforeCallCount = mockUseQuery.mock.calls.length;
    rerender();
    expect(mockUseQuery.mock.calls.length).toBeGreaterThan(beforeCallCount);
    expect(mockUseQuery.mock.calls.at(-1)?.[0]).toBe(reconnectSql);
  });

  it("coalesces data=undefined to [] so the first render does not throw", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    const { result } = renderHook(() => useBucketHealth());
    expect(result.current.hasServerBuckets).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("logs the first error→present transition once and does not re-log on subsequent renders", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });
    try {
      // Unique message: module-level dedup Set persists across tests; a fixed
      // "boom" would already be in the Set on a watch-mode re-run.
      const err = new Error(uniqueErrorMessage("boom"));
      mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
      const { rerender } = renderHook(() => useBucketHealth());
      rerender();
      rerender();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("re-logs when a different error appears (dedup is keyed by error.message)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });
    try {
      const first = new Error(uniqueErrorMessage("first"));
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: first,
      });
      const { rerender } = renderHook(() => useBucketHealth());
      // Clear the error.
      mockUseQuery.mockReturnValue({
        data: [{ count: 0 }],
        isLoading: false,
        error: null,
      });
      rerender();
      // New error with a different message: must log again because dedup
      // is keyed on `error.message`, not on a latched "have-logged" boolean.
      const second = new Error(uniqueErrorMessage("second"));
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: second,
      });
      rerender();
      expect(errorSpy).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });

  // Direct contract test for the keying claim — the dedup MUST be keyed on
  // `error.message`, not on error reference identity, error.stack, or a
  // latched "have-logged" boolean. The `__reset*` helper lets us start
  // from an empty Set so the assertions are not dependent on which other
  // tests ran first. Without this test, a regression that switched the
  // keying to e.g. `Set<Error>` (reference identity) would still satisfy
  // every other test in this file (which uses unique random suffixes that
  // hide identity-vs-message differences).
  it("dedup is keyed on error.message (verified via reset helper)", () => {
    __resetLoggedBucketHealthErrorsForTests();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });
    try {
      // Step 1: log Error reference A with message "shared".
      const errA = new Error("dedup-keying-contract");
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: errA,
      });
      renderHook(() => useBucketHealth());
      expect(errorSpy).toHaveBeenCalledTimes(1);

      // Step 2: a DIFFERENT Error reference with the SAME message must NOT
      // log — proves the dedup key is the message string, not the object
      // identity.
      const errB = new Error("dedup-keying-contract");
      expect(errB).not.toBe(errA);
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: errB,
      });
      renderHook(() => useBucketHealth());
      expect(errorSpy).toHaveBeenCalledTimes(1);

      // Step 3: a different message DOES log — proves the dedup is not a
      // latched "have-logged-anything" boolean.
      const errC = new Error("dedup-keying-contract-other");
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: errC,
      });
      renderHook(() => useBucketHealth());
      expect(errorSpy).toHaveBeenCalledTimes(2);

      // Step 4: after reset, the FIRST message logs again — proves the
      // reset helper is honest (and that subsequent tests can rely on a
      // clean Set when they explicitly call the reset).
      __resetLoggedBucketHealthErrorsForTests();
      const errD = new Error("dedup-keying-contract");
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: errD,
      });
      renderHook(() => useBucketHealth());
      expect(errorSpy).toHaveBeenCalledTimes(3);
    } finally {
      errorSpy.mockRestore();
      __resetLoggedBucketHealthErrorsForTests();
    }
  });

  // Pins the module-level dedup behavior introduced when prevErrorRef was
  // replaced with a Set<string> at module scope. Before the change, each new
  // hook instance held its own ref and re-logged the same error. Now, the
  // first instance logs; subsequent instances with the same error.message do
  // not. Two `renderHook` calls mount two independent consumers in this file.
  it("suppresses duplicate logs of the same error.message across hook instances", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress
    });
    try {
      const sharedMessage = uniqueErrorMessage("shared");
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error(sharedMessage),
      });
      renderHook(() => useBucketHealth());
      renderHook(() => useBucketHealth());
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
