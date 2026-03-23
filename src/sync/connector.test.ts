import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./events", () => ({
  dispatchSyncError: vi.fn(),
}));

import { dispatchSyncError } from "./events";

describe("createNeonConnector", () => {
  function importWithEnv(
    env: Record<string, string>
  ): Promise<typeof import("./connector")> {
    vi.resetModules();
    vi.stubEnv(
      "NEXT_PUBLIC_POWERSYNC_URL",
      env.NEXT_PUBLIC_POWERSYNC_URL ?? ""
    );
    return import("./connector");
  }

  const VALID_ENV = {
    NEXT_PUBLIC_POWERSYNC_URL: "https://ps.example.com",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when NEXT_PUBLIC_POWERSYNC_URL is missing", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_POWERSYNC_URL: "",
    });
    expect(() => mod.createNeonConnector(async () => "token")).toThrow(
      "NEXT_PUBLIC_POWERSYNC_URL"
    );
  });

  describe("fetchCredentials", () => {
    it("returns credentials when token is available", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");

      const result = await connector.fetchCredentials();

      expect(result).toEqual({
        endpoint: "https://ps.example.com",
        token: "my-token",
      });
    });

    it("returns null when no token is available", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => null);

      const result = await connector.fetchCredentials();

      expect(result).toBeNull();
    });
  });

  describe("uploadData", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function createMockDatabase(
      crud: Array<{
        id: string;
        op: string;
        table: string;
        opData?: Record<string, unknown>;
      }>
    ): { getNextCrudTransaction: ReturnType<typeof vi.fn> } {
      const transaction = {
        crud,
        complete: vi.fn(),
      };
      return {
        getNextCrudTransaction: vi.fn().mockResolvedValue(transaction),
      };
    }

    function batchResponse(
      results: Array<{
        index: number;
        status: number;
        error?: string;
      }>
    ): Response {
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    it("does nothing when there is no pending transaction", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "token");
      const db = {
        getNextCrudTransaction: vi.fn().mockResolvedValue(null),
      };

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(db.getNextCrudTransaction).toHaveBeenCalledOnce();
    });

    it("sends all operations in a single batch request", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 200 },
          { index: 1, status: 200 },
        ])
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Ambitious Card" },
        },
        {
          id: "trick-2",
          op: "PATCH",
          table: "tricks",
          opData: { name: "Updated Card" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("/api/powersync/batch");
      expect((init as RequestInit).method).toBe("POST");
      expect((init as RequestInit).credentials).toBe("same-origin");
      const body = JSON.parse((init as RequestInit).body as string) as {
        operations: unknown[];
      };
      expect(body.operations).toHaveLength(2);
    });

    it("maps UpdateType enum values to OpType strings in batch payload", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 200 },
          { index: 1, status: 200 },
          { index: 2, status: 200 },
        ])
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
        {
          id: "trick-2",
          op: "PATCH",
          table: "tricks",
          opData: { name: "Updated" },
        },
        { id: "trick-3", op: "DELETE", table: "tricks" },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const body = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as RequestInit).body as string
      ) as {
        operations: Array<{ op: string }>;
      };
      expect(body.operations[0]!.op).toBe("PUT");
      expect(body.operations[1]!.op).toBe("PATCH");
      expect(body.operations[2]!.op).toBe("DELETE");
    });

    it("passes opData through for PUT and PATCH operations", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 200 },
          { index: 1, status: 200 },
        ])
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Ambitious Card", difficulty: 3 },
        },
        {
          id: "trick-2",
          op: "PATCH",
          table: "tricks",
          opData: { name: "Updated Card" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const body = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as RequestInit).body as string
      ) as {
        operations: Array<{ opData?: Record<string, unknown> }>;
      };
      expect(body.operations[0]!.opData).toEqual({
        name: "Ambitious Card",
        difficulty: 3,
      });
      expect(body.operations[1]!.opData).toEqual({ name: "Updated Card" });
    });

    it("omits opData for DELETE operations", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(batchResponse([{ index: 0, status: 200 }]));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        { id: "trick-1", op: "DELETE", table: "tricks" },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const body = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as RequestInit).body as string
      ) as {
        operations: Array<{ opData?: Record<string, unknown> }>;
      };
      expect(body.operations[0]!.opData).toBeUndefined();
    });

    it("completes transaction when batch returns 200 with all operations succeeded", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([{ index: 0, status: 200 }])
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("reports per-operation 422 as permanent error and still completes transaction", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 422, error: "Constraint violation" },
        ])
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(customHandler).toHaveBeenCalledOnce();
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Constraint violation",
          status: 422,
        })
      );
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("mixed 200 and 422 results — permanent errors reported, transaction completes", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 200 },
          { index: 1, status: 422, error: "Constraint violation" },
          { index: 2, status: 200 },
        ])
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "First" },
        },
        {
          id: "trick-2",
          op: "PUT",
          table: "tricks",
          opData: { name: "Second" },
        },
        {
          id: "trick-3",
          op: "PUT",
          table: "tricks",
          opData: { name: "Third" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(customHandler).toHaveBeenCalledOnce();
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          op: expect.objectContaining({ id: "trick-2" }),
        })
      );
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("throws on 401 response (transient — will retry after re-auth)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Unauthorized");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
    });

    it("treats non-401 4xx as permanent — reports all ops and completes transaction", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Request", { status: 400 })
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "First" },
        },
        {
          id: "trick-2",
          op: "PUT",
          table: "tricks",
          opData: { name: "Second" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(customHandler).toHaveBeenCalledTimes(2);
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Server rejected batch (400)",
          status: 400,
        })
      );
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("throws on 500 response (transient — batch rolled back)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Batch execution failed",
            failedIndex: 0,
            results: [],
          }),
          { status: 500 }
        )
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Batch upload failed — will retry");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
    });

    it("throws on network error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("Failed to fetch")
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Failed to fetch");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
    });

    it("throws on AbortSignal timeout", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError")
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("The operation was aborted");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
    });

    it("filters disallowed table operations and reports them as permanent errors", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(batchResponse([{ index: 0, status: 200 }]));
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Valid" },
        },
        {
          id: "user-1",
          op: "PUT",
          table: "users",
          opData: { name: "Hacker" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      // Only the valid operation is sent in the batch
      expect(fetchSpy).toHaveBeenCalledOnce();
      const body = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as RequestInit).body as string
      ) as {
        operations: unknown[];
      };
      expect(body.operations).toHaveLength(1);

      // Disallowed table reported as permanent error
      expect(customHandler).toHaveBeenCalledOnce();
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Disallowed table: users",
          op: expect.objectContaining({ table: "users" }),
          status: 422,
        })
      );

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("completes immediately when all operations target disallowed tables", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "user-1",
          op: "PUT",
          table: "users",
          opData: { name: "A" },
        },
        {
          id: "user-2",
          op: "PUT",
          table: "users",
          opData: { name: "B" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(customHandler).toHaveBeenCalledTimes(2);
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("chunks large transactions into batches of 1000", async () => {
      const ops = Array.from({ length: 2500 }, (_, i) => ({
        id: `trick-${i}`,
        op: "PUT" as const,
        table: "tricks",
        opData: { name: `Trick ${i}` },
      }));
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () =>
          batchResponse(
            Array.from({ length: 1000 }, (_, i) => ({
              index: i,
              status: 200,
            }))
          )
        );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase(ops);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);

      // Verify chunk sizes
      const chunk1 = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as RequestInit).body as string
      ) as { operations: unknown[] };
      const chunk2 = JSON.parse(
        (fetchSpy.mock.calls[1]![1] as RequestInit).body as string
      ) as { operations: unknown[] };
      const chunk3 = JSON.parse(
        (fetchSpy.mock.calls[2]![1] as RequestInit).body as string
      ) as { operations: unknown[] };
      expect(chunk1.operations).toHaveLength(1000);
      expect(chunk2.operations).toHaveLength(1000);
      expect(chunk3.operations).toHaveLength(500);

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("stops processing chunks when a chunk returns 500", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const ops = Array.from({ length: 2000 }, (_, i) => ({
        id: `trick-${i}`,
        op: "PUT" as const,
        table: "tricks",
        opData: { name: `Trick ${i}` },
      }));
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          batchResponse(
            Array.from({ length: 1000 }, (_, i) => ({
              index: i,
              status: 200,
            }))
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: "Batch execution failed",
              failedIndex: 5,
              results: [],
            }),
            { status: 500 }
          )
        );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase(ops);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Batch upload failed — will retry");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
    });

    it("dispatches sync error event on permanent error with default handler", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 422, error: "Constraint violation" },
        ])
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(dispatchSyncError).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "tricks",
          operation: "PUT",
          status: 422,
          message: "Constraint violation",
        })
      );
    });

    it("does not dispatch sync error event when custom onUploadError is provided", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 422, error: "Constraint violation" },
        ])
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(customHandler).toHaveBeenCalledOnce();
      expect(dispatchSyncError).not.toHaveBeenCalled();
    });

    it("completes transaction when response has no results field", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("sends exactly BATCH_SIZE operations as a single chunk", async () => {
      const ops = Array.from({ length: 1000 }, (_, i) => ({
        id: `trick-${i}`,
        op: "PUT" as const,
        table: "tricks",
        opData: { name: `Trick ${i}` },
      }));
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () =>
          batchResponse(
            Array.from({ length: 1000 }, (_, i) => ({
              index: i,
              status: 200,
            }))
          )
        );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token");
      const db = createMockDatabase(ops);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("uses fallback message when 422 result has no error field", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([{ index: 0, status: 422 }])
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(customHandler).toHaveBeenCalledOnce();
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Permanent error",
          status: 422,
        })
      );
    });

    it("ignores 422 result with out-of-bounds index", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        batchResponse([
          { index: 0, status: 200 },
          { index: 999, status: 422, error: "Bad" },
        ])
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        onUploadError: customHandler,
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(customHandler).not.toHaveBeenCalled();
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });
  });
});
