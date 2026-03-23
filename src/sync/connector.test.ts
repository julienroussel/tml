import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@powersync/web", () => ({
  UpdateType: { PUT: "PUT", PATCH: "PATCH", DELETE: "DELETE" },
}));

vi.mock("./events", () => ({
  dispatchSyncError: vi.fn(),
}));

import { UpdateType } from "@powersync/web";
import { dispatchSyncError } from "./events";
import {
  buildQuery,
  isSqlParam,
  isSyncedTable,
  validateRecord,
} from "./queries";

describe("isSqlParam", () => {
  it("returns true for null", () => {
    expect(isSqlParam(null)).toBe(true);
  });

  it("returns true for string", () => {
    expect(isSqlParam("hello")).toBe(true);
  });

  it("returns true for number", () => {
    expect(isSqlParam(42)).toBe(true);
  });

  it("returns true for boolean", () => {
    expect(isSqlParam(true)).toBe(true);
    expect(isSqlParam(false)).toBe(true);
  });

  it("returns false for undefined", () => {
    expect(isSqlParam(undefined)).toBe(false);
  });

  it("returns false for object", () => {
    expect(isSqlParam({ key: "value" })).toBe(false);
  });

  it("returns false for array", () => {
    expect(isSqlParam([1, 2])).toBe(false);
  });
});

describe("isSyncedTable", () => {
  it("returns true for a synced table", () => {
    expect(isSyncedTable("tricks")).toBe(true);
  });

  it("returns false for a non-synced table", () => {
    expect(isSyncedTable("users")).toBe(false);
  });
});

describe("validateRecord", () => {
  it("accepts a valid table and columns", () => {
    expect(() =>
      validateRecord("tricks", { id: "1", name: "Ambitious Card" })
    ).not.toThrow();
  });

  it("throws for a disallowed column", () => {
    expect(() =>
      validateRecord("tricks", { id: "1", not_a_column: "bad" })
    ).toThrow('Disallowed column "not_a_column" on table "tricks"');
  });
});

describe("buildQuery", () => {
  describe("PUT", () => {
    it("generates an upsert query", () => {
      const result = buildQuery(
        UpdateType.PUT,
        "tricks",
        "abc",
        {
          id: "abc",
          name: "Card Trick",
        },
        "user-1"
      );

      expect(result.query).toContain("INSERT INTO");
      expect(result.query).toContain("ON CONFLICT");
      expect(result.query).toContain('"tricks"');
      expect(result.params).toEqual(["abc", "Card Trick", "user-1"]);
    });

    it("excludes id from ON CONFLICT SET clause", () => {
      const result = buildQuery(
        UpdateType.PUT,
        "tricks",
        "abc",
        {
          id: "abc",
          name: "Card Trick",
        },
        "user-1"
      );

      const onConflictPart = result.query.split("DO UPDATE SET")[1];
      expect(onConflictPart).not.toContain('"id"');
    });

    it("uses EXCLUDED references in ON CONFLICT SET clause", () => {
      const result = buildQuery(
        UpdateType.PUT,
        "tricks",
        "abc",
        {
          id: "abc",
          name: "Card Trick",
        },
        "user-1"
      );

      expect(result.query).toContain("EXCLUDED");
    });

    it("adds deleted_at = NULL resurrection clause when deleted_at not in record", () => {
      const result = buildQuery(
        UpdateType.PUT,
        "tricks",
        "abc",
        {
          id: "abc",
          user_id: "user1",
          name: "Test",
        },
        "user1"
      );

      const onConflictPart = result.query.split("DO UPDATE SET")[1];
      expect(onConflictPart).toContain('"deleted_at" = NULL');
    });

    it("uses NOW() for updated_at in ON CONFLICT SET clause", () => {
      const result = buildQuery(
        UpdateType.PUT,
        "tricks",
        "abc",
        {
          id: "abc",
          name: "Card Trick",
          updated_at: "2024-01-01T00:00:00Z",
        },
        "user-1"
      );

      const onConflictPart = result.query.split("DO UPDATE SET")[1];
      expect(onConflictPart).toContain('"updated_at" = NOW()');
      expect(onConflictPart).not.toContain('EXCLUDED."updated_at"');
    });
  });

  describe("PATCH", () => {
    it("generates an update query excluding id from SET", () => {
      const result = buildQuery(
        UpdateType.PATCH,
        "tricks",
        "abc",
        {
          id: "abc",
          name: "Updated Trick",
        },
        "user-1"
      );

      expect(result.query).toContain("UPDATE");
      expect(result.query).toContain("SET");
      expect(result.query).toContain("WHERE");
      expect(result.query).not.toContain('SET "id"');
      expect(result.params).toEqual(["Updated Trick", "abc", "user-1"]);
    });

    it("appends NOW() for updated_at instead of using client value", () => {
      const result = buildQuery(
        UpdateType.PATCH,
        "tricks",
        "abc",
        {
          id: "abc",
          name: "Updated Trick",
          updated_at: "2024-01-01T00:00:00Z",
        },
        "user-1"
      );

      expect(result.query).toContain('"updated_at" = NOW()');
      // updated_at client value should not be in params
      expect(result.params).not.toContain("2024-01-01T00:00:00Z");
      expect(result.params).toEqual(["Updated Trick", "abc", "user-1"]);
    });
  });

  describe("DELETE", () => {
    it("generates a soft-delete query using server-side NOW()", () => {
      const result = buildQuery(
        UpdateType.DELETE,
        "tricks",
        "abc",
        {},
        "user-1"
      );

      expect(result.query).toContain('"deleted_at" = NOW()');
      expect(result.query).toContain('"updated_at" = NOW()');
      expect(result.query).toContain('WHERE "id" = $1');
      expect(result.params).toEqual(["abc", "user-1"]);
    });
  });
});

describe("buildQuery with userId scoping", () => {
  it("adds user_id WHERE clause to PUT when userId is provided", () => {
    const result = buildQuery(
      UpdateType.PUT,
      "tricks",
      "abc",
      {
        id: "abc",
        user_id: "user-1",
        name: "Card Trick",
      },
      "user-1"
    );
    expect(result.query).toContain('"user_id"');
    expect(result.params).toContain("user-1");
  });

  it("adds user_id WHERE clause to PATCH when userId is provided", () => {
    const result = buildQuery(
      UpdateType.PATCH,
      "tricks",
      "abc",
      {
        id: "abc",
        name: "Updated Trick",
      },
      "user-1"
    );
    expect(result.query).toContain('"user_id"');
    expect(result.params).toContain("user-1");
  });

  it("adds user_id WHERE clause to DELETE when userId is provided", () => {
    const result = buildQuery(
      UpdateType.DELETE,
      "tricks",
      "abc",
      {
        id: "abc",
      },
      "user-1"
    );
    expect(result.query).toContain('"user_id"');
    expect(result.params).toContain("user-1");
  });

  it("includes user_id clause for junction tables", () => {
    const result = buildQuery(
      UpdateType.PUT,
      "routine_tricks",
      "abc",
      {
        id: "abc",
        user_id: "user-1",
        routine_id: "r1",
        trick_id: "t1",
        position: 1,
      },
      "user-1"
    );
    // Junction tables now have user_id in SYNCED_COLUMNS
    expect(result.params).toContain("user-1");
    expect(result.query).toContain('"user_id"');
  });
});

describe("createNeonConnector", () => {
  function importWithEnv(
    env: Record<string, string>
  ): Promise<typeof import("./connector")> {
    vi.resetModules();
    vi.stubEnv(
      "NEXT_PUBLIC_POWERSYNC_URL",
      env.NEXT_PUBLIC_POWERSYNC_URL ?? ""
    );
    vi.stubEnv(
      "NEXT_PUBLIC_NEON_DATA_API_URL",
      env.NEXT_PUBLIC_NEON_DATA_API_URL ?? ""
    );
    return import("./connector");
  }

  const VALID_ENV = {
    NEXT_PUBLIC_POWERSYNC_URL: "https://ps.example.com",
    NEXT_PUBLIC_NEON_DATA_API_URL: "https://neon.example.com",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when NEXT_PUBLIC_POWERSYNC_URL is missing", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_POWERSYNC_URL: "",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://neon.example.com",
    });
    expect(() => mod.createNeonConnector(async () => "token")).toThrow(
      "NEXT_PUBLIC_POWERSYNC_URL"
    );
  });

  it("throws when NEXT_PUBLIC_NEON_DATA_API_URL is missing", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_POWERSYNC_URL: "https://ps.example.com",
      NEXT_PUBLIC_NEON_DATA_API_URL: "",
    });
    expect(() => mod.createNeonConnector(async () => "token")).toThrow(
      "NEXT_PUBLIC_NEON_DATA_API_URL"
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

    it("throws when not authenticated", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => null);
      const db = createMockDatabase([
        {
          id: "1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Not authenticated");
    });

    it("sends PUT operations as upsert queries", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Ambitious Card", user_id: "user-1" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("https://neon.example.com");
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      expect(body.query).toContain("INSERT INTO");
      expect(body.query).toContain("ON CONFLICT");
      expect(body.params).toContain("trick-1");
      expect(body.params).toContain("Ambitious Card");
      expect((init as RequestInit).headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer my-token" })
      );
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction).toEqual(
        expect.objectContaining({
          complete: expect.any(Function),
        })
      );
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("injects authenticated userId into PUT params, overriding client-sent user_id", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "server-user-id",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test", user_id: "forged-user-id" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      // The authenticated userId must appear in params (for both the INSERT
      // values and the WHERE user_id scope), not the forged client value
      expect(body.params).toContain("server-user-id");
      expect(body.params).not.toContain("forged-user-id");
    });

    it("sends PATCH operations as update queries", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PATCH",
          table: "tricks",
          opData: { name: "Updated Card" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, patchInit] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((patchInit as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      expect(body.query).toContain("UPDATE");
      expect(body.query).toContain("SET");
      expect(body.query).toContain('"updated_at" = NOW()');
      expect(body.params).toContain("Updated Card");
      expect((patchInit as RequestInit).headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer my-token" })
      );
    });

    it("injects authenticated userId into PATCH WHERE clause", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "server-user-id",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PATCH",
          table: "tricks",
          opData: { name: "Updated", user_id: "forged-user-id" },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      // The authenticated userId must be used in the WHERE clause,
      // not the forged client-sent user_id
      expect(body.params).toContain("server-user-id");
      expect(body.params).not.toContain("forged-user-id");
      expect(body.query).toContain('"user_id"');
    });

    it("sends DELETE operations as soft-delete queries", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "DELETE",
          table: "tricks",
          opData: {},
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, deleteInit] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((deleteInit as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      expect(body.query).toContain('"deleted_at"');
      expect(body.query).toContain('"updated_at"');
      expect(body.params).toContain("trick-1");
      expect((deleteInit as RequestInit).headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer my-token" })
      );
    });

    it("handles DELETE with undefined opData without crashing", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "DELETE",
          table: "tricks",
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, deleteInit] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((deleteInit as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      expect(body.query).toContain('"deleted_at"');
      expect(body.params).toContain("trick-1");
    });

    it("completes the transaction after all operations succeed", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("skips 4xx errors and completes transaction", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Request", {
          status: 400,
          statusText: "Bad Request",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Upload error:",
        expect.stringContaining("400")
      );
    });

    it("throws and does not complete transaction on fetch failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
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
      ).rejects.toThrow("Sync upload failed — will retry");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
    });

    it("throws for non-primitive value in opData", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: { nested: "object" } },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow('Non-primitive value for column "name"');
    });

    it("throws for disallowed table in uploadData", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "user-1",
          op: "PUT",
          table: "users",
          opData: { name: "Hacker" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Disallowed table: users");
    });

    it("throws for disallowed column in uploadData", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
      const db = createMockDatabase([
        {
          id: "trick-1",
          op: "PUT",
          table: "tricks",
          opData: { name: "Test", evil_column: "bad" },
        },
      ]);

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow('Disallowed column "evil_column" on table "tricks"');
    });

    it("skips 4xx mutation but executes others and completes transaction", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response("Constraint violation", {
            status: 409,
            statusText: "Conflict",
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Upload error:",
        expect.stringContaining("409")
      );
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("throws when getToken returns a valid token but getUserId returns null", async () => {
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "valid-token", {
        getUserId: async () => null,
      });
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
      ).rejects.toThrow("Unauthorized: userId is required for mutations");
    });

    it("injects authenticated userId into junction table PUT", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "server-user-id",
      });
      const db = createMockDatabase([
        {
          id: "rt-1",
          op: "PUT",
          table: "routine_tricks",
          opData: {
            routine_id: "routine-1",
            trick_id: "trick-1",
            position: 1,
            user_id: "forged-user-id",
          },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      // No ownership check round-trips — just the mutation itself
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      // Authenticated userId must be used, not the forged one
      expect(body.params).toContain("server-user-id");
      expect(body.params).not.toContain("forged-user-id");
      expect(body.query).toContain('"user_id"');
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
    });

    it("scopes junction table PATCH by authenticated userId", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "server-user-id",
      });
      const db = createMockDatabase([
        {
          id: "rt-1",
          op: "PATCH",
          table: "routine_tricks",
          opData: {
            position: 2,
            user_id: "forged-user-id",
          },
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      expect(body.query).toContain("UPDATE");
      expect(body.query).toContain('"user_id"');
      expect(body.params).toContain("server-user-id");
      expect(body.params).not.toContain("forged-user-id");
    });

    it("scopes junction table DELETE by authenticated userId", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "server-user-id",
      });
      const db = createMockDatabase([
        {
          id: "rt-1",
          op: "DELETE",
          table: "routine_tricks",
          opData: {},
        },
      ]);

      await connector.uploadData(
        db as unknown as Parameters<typeof connector.uploadData>[0]
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        params: unknown[];
      };
      expect(body.query).toContain('"deleted_at"');
      expect(body.query).toContain('"user_id"');
      expect(body.params).toContain("server-user-id");
    });

    it("dispatches sync error event on 4xx with default handler", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Request", {
          status: 400,
          statusText: "Bad Request",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      expect(dispatchSyncError).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "tricks",
          operation: "PUT",
          status: 400,
          message: "Sync failed",
        })
      );
      // Two console.error calls: one from handleUploadError (detailed), one from defaultUploadErrorHandler
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Upload error:",
        expect.stringContaining("400")
      );
    });

    it("does not dispatch sync error event when custom onUploadError is provided", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Request", {
          status: 400,
          statusText: "Bad Request",
        })
      );
      const customHandler = vi.fn();
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

    it("throws when fetch rejects with a network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("Failed to fetch")
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
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

    it("treats 401 as transient — throws and does not complete transaction", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
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
      ).rejects.toThrow("Sync upload failed — will retry");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
      expect(dispatchSyncError).not.toHaveBeenCalled();
    });

    it("treats 403 as transient — throws and does not complete transaction", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Forbidden", {
          status: 403,
          statusText: "Forbidden",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
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
      ).rejects.toThrow("Sync upload failed — will retry");

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
      expect(dispatchSyncError).not.toHaveBeenCalled();
    });

    it("treats 404 as permanent — skips mutation and completes transaction", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 })
      );
    });

    it("treats 422 as permanent — skips mutation and completes transaction", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Unprocessable Entity", {
          status: 422,
          statusText: "Unprocessable Entity",
        })
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledWith(
        expect.objectContaining({ status: 422 })
      );
    });

    it("5xx error halts mutation loop — remaining operations are not executed", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response("Internal Server Error", {
            status: 500,
            statusText: "Internal Server Error",
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Sync upload failed — will retry");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
      expect(dispatchSyncError).not.toHaveBeenCalled();
    });

    it("4xx then 5xx — skips permanent error, throws on transient, does not complete", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response("Conflict", {
            status: 409,
            statusText: "Conflict",
          })
        )
        .mockResolvedValueOnce(
          new Response("Internal Server Error", {
            status: 500,
            statusText: "Internal Server Error",
          })
        );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
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

      await expect(
        connector.uploadData(
          db as unknown as Parameters<typeof connector.uploadData>[0]
        )
      ).rejects.toThrow("Sync upload failed — will retry");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const transaction =
        await db.getNextCrudTransaction.mock.results[0]!.value;
      expect(transaction.complete).not.toHaveBeenCalled();
      expect(dispatchSyncError).toHaveBeenCalledOnce();
      expect(dispatchSyncError).toHaveBeenCalledWith(
        expect.objectContaining({ status: 409 })
      );
    });

    it("AbortSignal timeout rejects and does not complete transaction", async () => {
      vi.mocked(dispatchSyncError).mockClear();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError")
      );
      const mod = await importWithEnv(VALID_ENV);
      const connector = mod.createNeonConnector(async () => "my-token", {
        getUserId: async () => "user-1",
      });
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
      expect(dispatchSyncError).not.toHaveBeenCalled();
    });
  });
});
