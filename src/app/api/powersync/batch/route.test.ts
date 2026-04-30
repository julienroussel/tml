import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetSession = vi.fn();
const mockIsUserBanned = vi.fn();

vi.mock("@/auth/ban-check", () => ({
  isUserBanned: (...args: unknown[]) => mockIsUserBanned(...args),
}));

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
  // Non-banned by default
  mockIsUserBanned.mockResolvedValue(false);
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

    it("returns 403 when user is banned", async () => {
      authenticatedSession();
      mockIsUserBanned.mockResolvedValue(true);
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [putOp("tricks", "t-1", { name: "Card Trick" })],
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({ error: "Forbidden" });
    });
  });

  describe("request validation", () => {
    it("returns 415 when Content-Type is not application/json", async () => {
      authenticatedSession();
      const { POST } = await import("./route");

      const request = new NextRequest(
        "https://themagiclab.app/api/powersync/batch",
        {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ operations: [] }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(415);
      const body = await response.json();
      expect(body).toEqual({
        error: "Content-Type must be application/json",
      });
    });

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

  describe("event_log invariants", () => {
    // Pin the application-layer audit-trail guard at route.ts:122-144 so a future
    // refactor of buildOperationQuery cannot silently delete it. The DB-layer GRANT
    // (migration 0020) is the load-bearing enforcement; this 422 is the friendly UX.
    it("rejects DELETE on event_log with status 422 (append-only)", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 0 });
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [deleteOp("event_log", "evt-1")],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({
        index: 0,
        status: 422,
        error: "Validation error",
      });

      // Validation throws before SAVEPOINT/SQL runs — no DELETE statement hits the wire.
      const calls = mockClientQuery.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(
        calls.some((q) => typeof q === "string" && q.includes("DELETE FROM"))
      ).toBe(false);
    });

    it.each([
      // `source` is the trust label distinguishing client-emitted from server-emitted
      // events — route.ts:131-135 explicitly omits it from the allowlist; this test
      // pins that decision against future refactors.
      ["source", { source: "server" }],
      ["payload", { payload: { x: 1 } }],
      ["event_type", { event_type: "trick.created" }],
      ["entity_type", { entity_type: "trick" }],
    ])("rejects PATCH on event_log mutating disallowed column %s", async (_label, opData) => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 0 });
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [patchOp("event_log", "evt-1", opData)],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({
        index: 0,
        status: 422,
        error: "Validation error",
      });

      // Belt-and-braces: validation throws before any SQL is built, so no UPDATE
      // against event_log should hit the wire. Without this, a refactor that
      // issues the UPDATE *then* returns 422 would silently violate the invariant.
      const calls = mockClientQuery.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(
        calls.some(
          (q) =>
            typeof q === "string" &&
            q.includes("UPDATE") &&
            q.includes('"event_log"')
        )
      ).toBe(false);
    });

    it("rejects PATCH on event_log mixing allowed + disallowed columns (no partial apply)", async () => {
      // Guards against a "be liberal in what you accept" refactor that would
      // silently drop the disallowed columns and proceed with the allowed ones —
      // every existing test would still pass while the audit-trail invariant is
      // violated. The whole PATCH must reject; no partial UPDATE may reach the wire.
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 0 });
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            patchOp("event_log", "evt-1", {
              deleted_at: "2026-04-30T10:00:00Z",
              payload: "{}",
            }),
          ],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toMatchObject({
        index: 0,
        status: 422,
        error: "Validation error",
      });

      const calls = mockClientQuery.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(
        calls.some(
          (q) =>
            typeof q === "string" &&
            q.includes("UPDATE") &&
            q.includes('"event_log"')
        )
      ).toBe(false);
    });

    it("permits PATCH on event_log mutating only deleted_at + updated_at (soft-delete path)", async () => {
      // Positive coverage for the allowlist: a PATCH limited to (deleted_at,
      // updated_at) is the soft-delete path described at route.ts:117-121 and
      // must succeed. Without this test, a future over-restriction (e.g.,
      // "if (op === OpType.PATCH) throw") would pass every negative test while
      // breaking offline soft-delete sync.
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      const response = await POST(
        createRequest({
          operations: [
            patchOp("event_log", "evt-1", {
              deleted_at: "2026-04-30T10:00:00Z",
            }),
          ],
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0]).toEqual({ index: 0, status: 200 });

      // Confirm the UPDATE actually went to the wire against event_log.
      const updateCall = mockClientQuery.mock.calls.find(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("UPDATE") &&
          sql.includes('"event_log"')
      );
      expect(updateCall).toBeDefined();
    });

    it("forces source = 'client' on event_log INSERT even when client sends 'server'", async () => {
      authenticatedSession();
      vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
      mockClientQuery.mockResolvedValue({ rowCount: 1 });
      const { POST } = await import("./route");

      await POST(
        createRequest({
          operations: [
            putOp("event_log", "evt-1", {
              event_type: "trick.created",
              entity_type: "trick",
              entity_id: "t-1",
              // Real clients pre-stringify via JSON.stringify(payload) — see
              // src/lib/events/log.ts:49. The route validator rejects raw objects.
              payload: "{}",
              source: "server",
            }),
          ],
        })
      );

      // Locate the INSERT by SQL prefix, not by call index — resilient against
      // pre-INSERT statements like SET LOCAL or SET ROLE that future refactors
      // could add.
      const insertCall = mockClientQuery.mock.calls.find(
        ([sql]) =>
          typeof sql === "string" &&
          sql.startsWith("INSERT INTO") &&
          sql.includes('"event_log"')
      );
      expect(insertCall).toBeDefined();
      const [, params] = insertCall!;
      expect(params).toContain("client");
      expect(params).not.toContain("server");
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

    describe("SQLSTATE exposure (per-op failure path)", () => {
      it("includes the Postgres SQLSTATE in the 500 response body for transient DB errors", async () => {
        // Regression guard for issue #220: 42703 undefined_column was returned as
        // a generic 500 with no code, hiding schema drift behind PowerSync's retry
        // loop. The SQLSTATE must round-trip to the client log.
        authenticatedSession();
        vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
        // Pin VERCEL_ENV explicitly so the assertion below isn't satisfied
        // vacuously by a CI runner that happens to set VERCEL_ENV=production.
        vi.stubEnv("VERCEL_ENV", "development");
        const undefinedColumnError = new Error(
          'column "user_id" of relation "item_tricks" does not exist'
        ) as Error & { code: string };
        undefinedColumnError.code = "42703";
        mockClientQuery
          .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
          .mockRejectedValueOnce(undefinedColumnError)
          .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK
        const { POST } = await import("./route");

        const response = await POST(
          createRequest({
            operations: [
              putOp("item_tricks", "it-1", {
                item_id: "i-1",
                trick_id: "t-1",
              }),
            ],
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toMatchObject({
          error: "Batch execution failed",
          failedIndex: 0,
          code: "42703",
        });
      });

      it("includes the SQLSTATE when VERCEL_ENV is unset (local pnpm dev without Vercel CLI)", async () => {
        // The env gate is a negative check (!== "production" && !== "preview"),
        // so an unset VERCEL_ENV — the most common path for `pnpm dev` —
        // currently exposes `code`. Pin this behavior so a future refactor to a
        // positive check (=== "development") doesn't silently break the local
        // debugging UX that issue #220's diagnostic logging was designed to fix.
        authenticatedSession();
        vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
        vi.stubEnv("VERCEL_ENV", "");
        const undefinedColumnError = new Error(
          'column "user_id" of relation "item_tricks" does not exist'
        ) as Error & { code: string };
        undefinedColumnError.code = "42703";
        mockClientQuery
          .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
          .mockRejectedValueOnce(undefinedColumnError)
          .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK
        const { POST } = await import("./route");

        const response = await POST(
          createRequest({
            operations: [
              putOp("item_tricks", "it-1", {
                item_id: "i-1",
                trick_id: "t-1",
              }),
            ],
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toMatchObject({
          error: "Batch execution failed",
          failedIndex: 0,
          code: "42703",
        });
      });

      it.each([
        ["production"],
        ["preview"],
      ])("omits the SQLSTATE from the response body when VERCEL_ENV=%s (server log retains it)", async (env) => {
        // Both production AND preview must omit `code` to limit information
        // disclosure to authenticated users — preview URLs are routinely
        // shared (PR comments, link previews) and any authenticated user
        // reaching them could enumerate schema state via SQLSTATE classes.
        // The SQLSTATE remains in the server log for operators with Vercel
        // log access. Non-production environments still expose `code` for
        // fast browser-side debugging during the issue #220 soak.
        authenticatedSession();
        vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
        vi.stubEnv("VERCEL_ENV", env);
        const undefinedColumnError = new Error(
          'column "user_id" of relation "item_tricks" does not exist'
        ) as Error & { code: string };
        undefinedColumnError.code = "42703";
        mockClientQuery
          .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
          .mockRejectedValueOnce(undefinedColumnError)
          .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK
        const { POST } = await import("./route");

        const response = await POST(
          createRequest({
            operations: [
              putOp("item_tricks", "it-1", {
                item_id: "i-1",
                trick_id: "t-1",
              }),
            ],
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).not.toHaveProperty("code");
        expect(body).toMatchObject({
          error: "Batch execution failed",
          failedIndex: 0,
        });
      });

      it("omits the code field when the transient error has no SQLSTATE", async () => {
        authenticatedSession();
        vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
        // Pin VERCEL_ENV to a non-production value so this assertion isolates
        // the "no SQLSTATE on the error" code path. Without the stub, a CI
        // runner setting VERCEL_ENV=production would satisfy the assertion
        // vacuously via the env gate instead of the no-code branch.
        vi.stubEnv("VERCEL_ENV", "development");
        mockClientQuery
          .mockResolvedValueOnce({ rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rowCount: 0 }) // SAVEPOINT sp_0
          .mockRejectedValueOnce(new Error("connection timeout"))
          .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK
        const { POST } = await import("./route");

        const response = await POST(
          createRequest({
            operations: [putOp("tricks", "t-1", { name: "A" })],
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).not.toHaveProperty("code");
      });
    });

    describe("SQLSTATE exposure (outer catch path)", () => {
      it("includes the SQLSTATE in the 500 body in non-production", async () => {
        // Coverage for the outer-catch path (route.ts ~452): when BEGIN itself
        // throws a DB error, executeBatch re-throws into the POST handler's
        // outer catch. Verify the env gate behaves the same way as the inner
        // per-op-failure branch.
        authenticatedSession();
        vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
        vi.stubEnv("VERCEL_ENV", "development");
        const beginError = new Error(
          "connection terminated unexpectedly"
        ) as Error & { code: string };
        // 08006 (connection_failure) is the SQLSTATE Postgres realistically
        // raises on a failed BEGIN — 25P02 (in_failed_sql_transaction) cannot
        // be raised by BEGIN itself, only by subsequent statements on an
        // already-failed connection.
        beginError.code = "08006";
        mockClientQuery
          .mockRejectedValueOnce(beginError) // BEGIN
          .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK in catch
        const { POST } = await import("./route");

        const response = await POST(
          createRequest({
            operations: [putOp("tricks", "t-1", { name: "A" })],
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toMatchObject({
          error: "Internal server error",
          code: "08006",
        });
      });

      it.each([
        ["production"],
        ["preview"],
      ])("omits the SQLSTATE from the 500 body when VERCEL_ENV=%s", async (env) => {
        authenticatedSession();
        vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
        vi.stubEnv("VERCEL_ENV", env);
        const beginError = new Error(
          "connection terminated unexpectedly"
        ) as Error & { code: string };
        beginError.code = "08006";
        mockClientQuery
          .mockRejectedValueOnce(beginError) // BEGIN
          .mockResolvedValueOnce({ rowCount: 0 }); // ROLLBACK in catch
        const { POST } = await import("./route");

        const response = await POST(
          createRequest({
            operations: [putOp("tricks", "t-1", { name: "A" })],
          })
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).not.toHaveProperty("code");
        expect(body).toMatchObject({ error: "Internal server error" });
      });
    });
  });
});
