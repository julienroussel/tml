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

      // 9 DELETE queries (no transaction wrapping)
      mockQuery.mockResolvedValue({ rowCount: 2 });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.totalDeleted).toBe(18); // 9 tables x 2 rows each

      expect(body.errorsCount).toBe(0);
      // No internal table names should be exposed
      expect(body.deleted).toBeUndefined();
      expect(body.errors).toBeUndefined();

      // 9 DELETEs (no BEGIN/COMMIT — independent per-table deletes)
      expect(mockQuery).toHaveBeenCalledTimes(9);
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
      const junctionIndex = calls.findIndex((q) => q.includes("item_tricks"));
      const parentIndex = calls.findIndex((q) => q.includes('"tricks"'));
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

      // First DELETE fails, remaining 8 succeed
      mockQuery
        .mockRejectedValueOnce(new Error("DB connection lost"))
        .mockResolvedValue({ rowCount: 1 });

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      // First table failed, 8 succeeded with 1 row each
      expect(body.totalDeleted).toBe(8);
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

      mockQuery
        .mockRejectedValueOnce(new Error("Disk full"))
        .mockResolvedValue({ rowCount: 0 });

      await GET(createRequest("Bearer test-cron-secret"));

      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it("processes all tables even when errors occur mid-batch", async () => {
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("DATABASE_URL", "postgres://test");
      vi.resetModules();
      const { GET } = await import("./route");

      // First DELETE succeeds, second fails, rest succeed
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 }) // first DELETE
        .mockRejectedValueOnce(new Error("Disk full")) // second DELETE
        .mockResolvedValue({ rowCount: 0 }); // remaining DELETEs

      const response = await GET(createRequest("Bearer test-cron-secret"));

      expect(response.status).toBe(200);
      // All 9 tables are attempted despite the mid-batch error
      expect(mockQuery).toHaveBeenCalledTimes(9);
    });
  });
});
