import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetSession = vi.fn();

vi.mock("@/auth/server", () => ({
  auth: { getSession: mockGetSession },
}));

const mockClientQuery = vi.fn();
const mockClientRelease = vi.fn();
const mockPoolConnect = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  Pool: class MockPool {
    connect = mockPoolConnect;
  },
}));

beforeEach(() => {
  mockClientRelease.mockResolvedValue(undefined);
  mockPoolConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
  });
  // BEGIN and COMMIT succeed by default
  mockClientQuery.mockResolvedValue({ rowCount: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Reset the module-level pool singleton between tests
  vi.resetModules();
  // Coupled to the production pool singleton name — if renamed, this cleanup silently breaks.
  globalThis.__batchPool = undefined;
});

function createRequest(body: unknown): NextRequest {
  return new NextRequest("https://themagiclab.app/api/powersync/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createMalformedRequest(): NextRequest {
  return new NextRequest("https://themagiclab.app/api/powersync/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not valid json",
  });
}

const SESSION_USER_ID = "user-abc-123";

function authenticatedSession(): void {
  mockGetSession.mockResolvedValue({
    data: { user: { id: SESSION_USER_ID } },
  });
}

/** Helper to build a PUT operation for tests. */
function putOp(
  table: string,
  id: string,
  opData: Record<string, unknown>
): { id: string; op: string; opData: Record<string, unknown>; table: string } {
  return { table, op: "PUT", id, opData };
}

/** Helper to build a PATCH operation for tests. */
function patchOp(
  table: string,
  id: string,
  opData: Record<string, unknown>
): { id: string; op: string; opData: Record<string, unknown>; table: string } {
  return { table, op: "PATCH", id, opData };
}

/** Helper to build a DELETE operation for tests. */
function deleteOp(
  table: string,
  id: string
): { id: string; op: string; table: string } {
  return { table, op: "DELETE", id };
}

describe("POST /api/powersync/batch", () => {
  describe("authorization", () => {
    it("returns 401 when there is no active session", async () => {
      mockGetSession.mockResolvedValue({ data: null });
      const { POST } = await import("./route");

      const response = await POST(createRequest({ operations: [] }));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no user", async () => {
      mockGetSession.mockResolvedValue({ data: { user: null } });
      const { POST } = await import("./route");

      const response = await POST(createRequest({ operations: [] }));

      expect(response.status).toBe(401);
    });

    it("returns 401 when session user has no id", async () => {
      mockGetSession.mockResolvedValue({ data: { user: {} } });
      const { POST } = await import("./route");

      const response = await POST(createRequest({ operations: [] }));

      expect(response.status).toBe(401);
    });
  });

  describe("request validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(createMalformedRequest());

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: "Invalid JSON" });
    });

    it("returns 400 when operations array is missing", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(createRequest({}));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: "No operations provided" });
    });

    it("returns 400 when operations is not an array", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: "not-an-array",
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: "No operations provided" });
    });

    it("returns 400 when operations array is empty", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(createRequest({ operations: [] }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: "No operations provided" });
    });

    it("returns 400 when an operation has an invalid op type", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [{ table: "tricks", op: "DROP", id: "t-1" }],
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({
        error: "Operation at index 0 is malformed",
      });
    });

    it("returns 400 when an operation is missing required fields", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [{ table: "tricks" }],
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({
        error: "Operation at index 0 is malformed",
      });
    });

    it("returns 400 when batch exceeds MAX_BATCH_SIZE", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const operations = Array.from({ length: 1001 }, (_, i) =>
        putOp("tricks", `t-${i}`, { name: `Trick ${i}` })
      );

      const response = await POST(createRequest({ operations }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({
        error: "Batch size 1001 exceeds maximum 1000",
      });
    });
  });

  describe("table and column validation", () => {
    it("returns 400 for a disallowed table name", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("users", "u-1", { name: "Hacker" })],
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Operation at index 0 is malformed");
    });

    it("returns 200 with 422 result for a disallowed column", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 0 });
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("tricks", "t-1", { name: "Card Trick", evil_col: "x" }),
          ],
        })
      );

      // Validation errors are permanent (422), not transient (500).
      // The batch completes successfully but reports the failing operation.
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({
        index: 0,
        status: 422,
        error: "Validation error",
      });
    });
  });

  describe("database configuration", () => {
    it("returns 500 when DATABASE_URL is not set", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "");
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "Card Trick" })],
        })
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Database not configured" });
    });
  });

  describe("successful batch execution", () => {
    it("executes all operations and returns 200 results", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("tricks", "trick-1", { name: "Ambitious Card" }),
            patchOp("tricks", "trick-1", { name: "Updated Card" }),
          ],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results).toHaveLength(2);
      expect(body.results[0]).toEqual({ index: 0, status: 200 });
      expect(body.results[1]).toEqual({ index: 1, status: 200 });
    });

    it("wraps operations in a transaction with BEGIN, SAVEPOINTs, and COMMIT", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "Test" })],
        })
      );

      const calls = mockClientQuery.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      // BEGIN → SAVEPOINT "sp_0" → INSERT → RELEASE SAVEPOINT "sp_0" → COMMIT
      expect(calls[0]).toBe("BEGIN");
      expect(calls[1]).toBe('SAVEPOINT "sp_0"');
      expect(calls[3]).toBe('RELEASE SAVEPOINT "sp_0"');
      expect(calls.at(-1)).toBe("COMMIT");
    });

    it("releases the client after successful execution", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "Test" })],
        })
      );

      expect(mockClientRelease).toHaveBeenCalledOnce();
    });

    it("builds parameterized SQL from structured operations", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [putOp("tricks", "trick-42", { name: "Vanish" })],
        })
      );

      // The query should be parameterized SQL built by buildQuery, not raw user SQL
      // Skip BEGIN and SAVEPOINT sp_0, the actual query is the third call
      const [query, params] = mockClientQuery.mock.calls[2]!;
      expect(query).toContain("INSERT INTO");
      expect(query).toContain('"tricks"');
      expect(query).toContain("$1");
      expect(params).toContain("trick-42");
    });

    it("handles DELETE operations correctly", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [deleteOp("tricks", "trick-1")],
        })
      );

      // Skip BEGIN and SAVEPOINT sp_0, the actual query is the third call
      const [query] = mockClientQuery.mock.calls[2]!;
      expect(query).toContain("deleted_at");
      expect(query).toContain("updated_at");
    });

    it("handles PATCH operations correctly", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [patchOp("tricks", "trick-1", { name: "Updated Name" })],
        })
      );

      // Skip BEGIN and SAVEPOINT sp_0, the actual query is the third call
      const [query, params] = mockClientQuery.mock.calls[2]!;
      expect(query).toContain("UPDATE");
      expect(query).toContain('"tricks"');
      expect(query).toContain("SET");
      expect(query).toContain('"name"');
      expect(query).toContain('"updated_at" = NOW()');
      expect(params).toContain("Updated Name");
      expect(params).toContain("trick-1");
    });

    it("forces the authenticated user_id on all operations", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [
            putOp("tricks", "trick-1", {
              name: "Card Trick",
              user_id: "evil-user",
            }),
          ],
        })
      );

      // Skip BEGIN and SAVEPOINT sp_0, the actual query is the third call
      const [, params] = mockClientQuery.mock.calls[2]!;
      // The user_id in the params should be the session user, not "evil-user"
      expect(params).toContain(SESSION_USER_ID);
      expect(params).not.toContain("evil-user");
    });
  });

  describe("permanent database errors (constraint violations)", () => {
    function makeDbError(
      code: string,
      message: string
    ): Error & { code: string } {
      const error = new Error(message) as Error & { code: string };
      error.code = code;
      return error;
    }

    it("reports unique_violation (23505) as status 422 and continues", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(makeDbError("23505", "duplicate key value"))
        .mockResolvedValueOnce({ rowCount: 0 }) // ROLLBACK TO SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_1
        .mockResolvedValueOnce({ rowCount: 1 }) // second operation
        .mockResolvedValueOnce({ rowCount: 0 }) // RELEASE SAVEPOINT sp_1
        .mockResolvedValueOnce({ rowCount: 0 }); // COMMIT
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("tricks", "dup-id", { name: "First" }),
            putOp("tricks", "new-id", { name: "Second" }),
          ],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results).toHaveLength(2);
      expect(body.results[0]).toEqual({
        index: 0,
        status: 422,
        error: "Constraint violation",
      });
      expect(body.results[1]).toEqual({ index: 1, status: 200 });
    });

    it("reports foreign_key_violation (23503) as status 422 and continues", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(
          makeDbError("23503", "foreign key constraint violation")
        )
        .mockResolvedValueOnce({ rowCount: 0 }) // ROLLBACK TO SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }); // COMMIT
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("item_tricks", "it-1", {
              item_id: "a",
              trick_id: "b",
            }),
          ],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({ index: 0, status: 422 });
    });

    it("reports not_null_violation (23502) as status 422", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(makeDbError("23502", "null value in column"))
        .mockResolvedValueOnce({ rowCount: 0 }) // ROLLBACK TO SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }); // COMMIT
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: null })],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({ index: 0, status: 422 });
    });

    it("reports check_violation (23514) as status 422", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(
          makeDbError("23514", "check constraint violation")
        )
        .mockResolvedValueOnce({ rowCount: 0 }) // ROLLBACK TO SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }); // COMMIT
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "Bad" })],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({ index: 0, status: 422 });
    });

    it("reports invalid_text_representation (22P02) as status 422", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(makeDbError("22P02", "invalid input syntax"))
        .mockResolvedValueOnce({ rowCount: 0 }) // ROLLBACK TO SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }); // COMMIT
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "not-a-uuid", { name: "Test" })],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({ index: 0, status: 422 });
    });

    it("reports numeric_value_out_of_range (22003) as status 422", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(
          makeDbError("22003", "numeric value out of range")
        )
        .mockResolvedValueOnce({ rowCount: 0 }) // ROLLBACK TO SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }); // COMMIT
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "Big" })],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({ index: 0, status: 422 });
    });
  });

  describe("temporary database errors", () => {
    it("returns 500 and aborts the batch for non-permanent errors", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(new Error("connection timeout"));
      // ROLLBACK will use default mock (resolves)
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("tricks", "id-1", { name: "A" }),
            putOp("tricks", "id-2", { name: "B" }),
          ],
        })
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Batch execution failed");
      expect(body.failedIndex).toBe(0);
    });

    it("issues ROLLBACK on transient errors", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(new Error("connection timeout"))
        .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "A" })],
        })
      );

      const calls = mockClientQuery.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(calls).toContain("ROLLBACK");
    });

    it("reports the index of the failing operation when error occurs mid-batch", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 1 }) // op 0
        .mockResolvedValueOnce({ rowCount: 0 }) // RELEASE SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_1
        .mockResolvedValueOnce({ rowCount: 1 }) // op 1
        .mockResolvedValueOnce({ rowCount: 0 }) // RELEASE SAVEPOINT sp_1
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_2
        .mockRejectedValueOnce(new Error("deadlock detected")); // op 2
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("tricks", "t-1", { name: "A" }),
            putOp("tricks", "t-2", { name: "B" }),
            putOp("tricks", "t-3", { name: "C" }),
          ],
        })
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.failedIndex).toBe(2);
      // Results include operations that succeeded before the failure (for debugging)
      // — note the entire transaction is rolled back, so none were persisted
      expect(body.results).toHaveLength(2);
      expect(body.results[0]).toEqual({
        index: 0,
        status: 200,
        rolledBack: true,
      });
      expect(body.results[1]).toEqual({
        index: 1,
        status: 200,
        rolledBack: true,
      });
    });

    it("includes already-completed results when aborting mid-batch", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 1 }) // op 0
        .mockResolvedValueOnce({ rowCount: 0 }) // RELEASE SAVEPOINT sp_0
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_1
        .mockRejectedValueOnce(new Error("server error")); // op 1
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            putOp("tricks", "t-1", { name: "A" }),
            putOp("tricks", "t-2", { name: "B" }),
          ],
        })
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      // Results include the operation that succeeded before the failure (for debugging)
      // — the entire transaction is rolled back, so it was not persisted
      expect(body.results).toEqual([
        { index: 0, status: 200, rolledBack: true },
      ]);
    });

    it("releases the client even when the batch aborts with a temporary error", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(new Error("network error")); // op
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "A" })],
        })
      );

      expect(mockClientRelease).toHaveBeenCalledOnce();
    });

    it("treats an error without a code property as a temporary error", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(new Error("generic error"));
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "A" })],
        })
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Batch execution failed");
    });

    it("treats an unknown PG error code as a temporary error", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      const unknownError = new Error("something weird") as Error & {
        code: string;
      };
      unknownError.code = "99999";
      mockClientQuery
        .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
        .mockRejectedValueOnce(unknownError);
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "A" })],
        })
      );

      expect(response.status).toBe(500);
    });
  });
});
