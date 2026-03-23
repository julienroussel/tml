import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// timingSafeEqual is mocked with plain string equality for unit test determinism.
// The auth boundary (timing-attack resistance) is covered by the real implementation;
// these tests only verify the route's request/response logic.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    timingSafeEqual: (a: Buffer, b: Buffer) => a.toString() === b.toString(),
  };
});

const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockEnd = vi.fn();
const mockConnect = vi.fn();

vi.mock("@neondatabase/serverless", () => {
  class MockPool {
    connect = mockConnect;
    end = mockEnd;
  }
  return { Pool: MockPool };
});

// Default: mockConnect returns a client with our mockQuery / mockRelease
mockConnect.mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Restore default connect behaviour after each test
  mockConnect.mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
});

function createRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("authorization", authHeader);
  }
  return new NextRequest("https://themagiclab.app/api/cron/cleanup", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/cleanup", () => {
  describe("authorization", () => {
    it("returns 401 when CRON_SECRET env var is not set", async () => {
      vi.stubEnv("CRON_SECRET", "");
      vi.resetModules();
      const { GET } = await import("./route");

      const response = await GET(createRequest("Bearer some-secret"));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when no Authorization header is provided", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.resetModules();
      const { GET } = await import("./route");

      const response = await GET(createRequest());

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when Authorization header has wrong secret", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.resetModules();
      const { GET } = await import("./route");

      const response = await GET(createRequest("Bearer wrong-secret"));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when Authorization header is missing the Bearer prefix", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.resetModules();
      const { GET } = await import("./route");

      const response = await GET(createRequest("test-cron-secret"));

      expect(response.status).toBe(401);
    });
  });

  describe("configuration", () => {
    it("returns 500 when DATABASE_URL is not set", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "");
      vi.resetModules();
      const { GET } = await import("./route");

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Database not configured" });
    });
  });

  describe("successful cleanup", () => {
    it("executes DELETE for every table and returns row counts", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // 9 pre-pass UPDATEs + 9 main DELETEs + 1 user DELETE = 19 queries
      mockQuery.mockResolvedValue({ rowCount: 2 });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      // 9 main tables + 1 user delete = 10 results, each with rowCount 2
      expect(body.totalDeleted).toBe(20);

      expect(body.errorsCount).toBe(0);
      // No internal table names should be exposed
      expect(body.deleted).toBeUndefined();
      expect(body.errors).toBeUndefined();

      // 9 pre-pass UPDATEs + 9 main DELETEs + 1 user DELETE
      expect(mockQuery).toHaveBeenCalledTimes(19);
    });

    it("handles tables with zero deleted rows", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: 0 });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.totalDeleted).toBe(0);
    });

    it("treats null rowCount as 0", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: null });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalDeleted).toBe(0);
    });

    it("processes tables in junction-first order", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      const calls = mockQuery.mock.calls.map((call) => call[0] as string);
      // Skip pre-pass UPDATEs (first 9), find DELETEs in the main loop
      const deleteQueries = calls.filter((q) => q.includes("DELETE"));
      const junctionIndex = deleteQueries.findIndex((q) =>
        q.includes("item_tricks")
      );
      const parentIndex = deleteQueries.findIndex((q) =>
        q.includes('"tricks"')
      );
      expect(junctionIndex).toBeLessThan(parentIndex);
    });

    it("includes the 30-day retention interval in the DELETE queries", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      // First DELETE is index 0 (no BEGIN — independent per-table deletes)
      const firstDeleteCall = mockQuery.mock.calls[0]?.[0] as string;
      expect(firstDeleteCall).toContain("INTERVAL '1 day' * $1");
      expect(firstDeleteCall).toContain("deleted_at IS NOT NULL");
      // Verify retention days is passed as a parameter
      const firstDeleteParams = mockQuery.mock.calls[0]?.[1] as unknown[];
      expect(firstDeleteParams).toContain(30);
    });

    it("issues UPDATE tombstone queries for user-owned tables before DELETEs", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      const calls = mockQuery.mock.calls.map((call) => call[0] as string);
      const updateCalls = calls.filter((q) => q.startsWith("UPDATE"));
      expect(updateCalls).toHaveLength(9);
      for (const sql of updateCalls) {
        expect(sql).toContain("SET deleted_at = NOW()");
        expect(sql).toContain("INTERVAL '1 day' * $1");
      }
    });

    it("continues main cleanup when a pre-pass UPDATE fails", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // First pre-pass UPDATE fails, rest succeed
      mockQuery
        .mockRejectedValueOnce(new Error("pre-pass failure"))
        .mockResolvedValue({ rowCount: 0 });

      const response = await GET(createRequest("Bearer test-cron-secret"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it("releases the client and ends the pool after success", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe("per-table error handling", () => {
    it("continues cleanup when a table DELETE fails and reports errors", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // 9 pre-pass UPDATEs succeed, first main DELETE fails, rest succeed
      for (let i = 0; i < 9; i++) {
        mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // pre-pass
      }
      mockQuery
        .mockRejectedValueOnce(new Error("DB connection lost"))
        .mockResolvedValue({ rowCount: 1 });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      // First main table failed, 8 main + 1 user succeeded with 1 row each
      expect(body.totalDeleted).toBe(9);
      expect(body.errorsCount).toBe(1);
      // No internal table names should be exposed
      expect(body.deleted).toBeUndefined();
      expect(body.errors).toBeUndefined();
    });

    it("handles non-Error thrown by a table DELETE", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // 9 pre-pass UPDATEs succeed, then first main DELETE throws a string
      for (let i = 0; i < 9; i++) {
        mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      }
      mockQuery
        .mockRejectedValueOnce("string error")
        .mockResolvedValue({ rowCount: 0 });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.errorsCount).toBe(1);
      expect(body.errors).toBeUndefined();
    });

    it("returns 500 when pool.connect fails", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      mockConnect.mockRejectedValueOnce(new Error("Connection refused"));
      const { GET } = await import("./route");

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Cleanup failed" });
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it("releases the client and ends the pool even after table errors", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // 9 pre-pass UPDATEs succeed, then first main DELETE fails
      for (let i = 0; i < 9; i++) {
        mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      }
      mockQuery
        .mockRejectedValueOnce(new Error("Disk full"))
        .mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it("includes NOT EXISTS child checks in the user cleanup query", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      mockQuery.mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      const calls = mockQuery.mock.calls.map((call) => call[0] as string);
      // Last query is the user cleanup DELETE
      const userDeleteQuery = calls.at(-1);
      expect(userDeleteQuery).toContain('DELETE FROM "users"');
      expect(userDeleteQuery).toContain("NOT EXISTS");
      for (const table of [
        "goals",
        "item_tricks",
        "items",
        "performances",
        "practice_session_tricks",
        "practice_sessions",
        "routine_tricks",
        "routines",
        "tricks",
      ]) {
        expect(userDeleteQuery).toContain(`"${table}"`);
      }
    });

    it("reports error when user cleanup fails without crashing", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // All pre-pass (9) + main DELETEs (9) succeed, user DELETE fails
      for (let i = 0; i < 18; i++) {
        mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      }
      mockQuery.mockRejectedValueOnce(new Error("FK violation"));

      const response = await GET(createRequest("Bearer test-cron-secret"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.errorsCount).toBe(1);
    });

    it("returns success false when all cleanup operations fail", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // All queries fail
      mockQuery.mockRejectedValue(new Error("DB down"));

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.totalDeleted).toBe(0);
      expect(body.errorsCount).toBeGreaterThan(0);
    });

    it("processes all tables even when errors occur mid-batch", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // 9 pre-pass UPDATEs succeed, first main DELETE succeeds,
      // second fails, rest succeed
      for (let i = 0; i < 9; i++) {
        mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      }
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 }) // first main DELETE
        .mockRejectedValueOnce(new Error("Disk full")) // second main DELETE
        .mockResolvedValue({ rowCount: 0 }); // remaining DELETEs + user

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      // 9 pre-pass + 9 main DELETEs + 1 user DELETE = 19 total queries
      expect(mockQuery).toHaveBeenCalledTimes(19);
    });
  });
});
