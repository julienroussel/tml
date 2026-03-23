import { describe, expect, it } from "vitest";
import {
  buildQuery,
  coerceOpRecord,
  isSqlParam,
  isSyncedTable,
  OpType,
  quoteId,
  validateRecord,
} from "./queries";

const MISSING_OP_DATA_PATTERN = /Missing opData/;
const USER_ID_WHERE_PATTERN = /WHERE\s+"tricks"\."user_id"\s*=\s*\$/;
const NON_PRIMITIVE_NESTED_PATTERN = /Non-primitive value for column "nested"/;
const NON_PRIMITIVE_TAGS_PATTERN = /Non-primitive value for column "tags"/;

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

describe("coerceOpRecord", () => {
  it("coerces a normal record with primitive values", () => {
    const result = coerceOpRecord(
      { name: "Card Trick", difficulty: 3, active: true },
      "trick-1",
      "tricks"
    );

    expect(result).toEqual({
      id: "trick-1",
      name: "Card Trick",
      difficulty: 3,
      active: true,
    });
  });

  it("includes null values in the coerced record", () => {
    const result = coerceOpRecord(
      { name: "Card Trick", notes: null },
      "trick-1",
      "tricks"
    );

    expect(result).toEqual({
      id: "trick-1",
      name: "Card Trick",
      notes: null,
    });
  });

  it("throws when opData is undefined", () => {
    expect(() => coerceOpRecord(undefined, "trick-1", "tricks")).toThrow(
      MISSING_OP_DATA_PATTERN
    );
  });

  it("includes the table and id in the error message for missing opData", () => {
    expect(() => coerceOpRecord(undefined, "abc-123", "routines")).toThrow(
      'Missing opData for table "routines" (id: abc-123)'
    );
  });

  it("throws when a value is a non-primitive (object)", () => {
    expect(() =>
      coerceOpRecord(
        { name: "Test", nested: { foo: "bar" } },
        "trick-1",
        "tricks"
      )
    ).toThrow(NON_PRIMITIVE_NESTED_PATTERN);
  });

  it("throws when a value is an array", () => {
    expect(() =>
      coerceOpRecord({ name: "Test", tags: ["a", "b"] }, "trick-1", "tricks")
    ).toThrow(NON_PRIMITIVE_TAGS_PATTERN);
  });

  it("overrides the id in opData with the provided id", () => {
    const result = coerceOpRecord(
      { id: "should-be-overridden", name: "Test" },
      "correct-id",
      "tricks"
    );

    expect(result.id).toBe("correct-id");
  });
});

describe("quoteId", () => {
  it("quotes a normal identifier", () => {
    expect(quoteId("tricks")).toBe('"tricks"');
  });

  it("rejects identifiers with spaces", () => {
    expect(() => quoteId("my table")).toThrow("Invalid identifier: my table");
  });

  it("rejects identifiers with double quotes", () => {
    expect(() => quoteId('trick"name')).toThrow("Invalid identifier");
  });

  it("rejects identifiers starting with a number", () => {
    expect(() => quoteId("1tricks")).toThrow("Invalid identifier: 1tricks");
  });

  it("rejects empty strings", () => {
    expect(() => quoteId("")).toThrow("Invalid identifier: ");
  });

  it("allows underscored identifiers", () => {
    expect(quoteId("user_id")).toBe('"user_id"');
  });

  it("allows identifiers starting with underscore", () => {
    expect(quoteId("_private")).toBe('"_private"');
  });
});

describe("validateRecord", () => {
  it("accepts valid columns without throwing", () => {
    expect(() =>
      validateRecord("tricks", { id: "trick-1", name: "Test", user_id: "u1" })
    ).not.toThrow();
  });

  it("throws with a descriptive message for disallowed columns", () => {
    expect(() =>
      validateRecord("tricks", {
        id: "trick-1",
        name: "Test",
        hacker_field: "nope",
      })
    ).toThrow('Disallowed column "hacker_field" on table "tricks"');
  });
});

describe("buildQuery", () => {
  const userId = "user-123";

  describe("PUT operations", () => {
    it("generates an INSERT with ON CONFLICT for upsert", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "trick-1",
        { id: "trick-1", name: "Card Trick", user_id: userId },
        userId
      );

      expect(result.query).toContain("INSERT INTO");
      expect(result.query).toContain('"tricks"');
      expect(result.query).toContain('ON CONFLICT ("id") DO UPDATE SET');
      expect(result.params).toEqual(["trick-1", "Card Trick", userId, userId]);
    });

    it("scopes the upsert to the authenticated user_id", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "trick-1",
        { id: "trick-1", name: "Test", user_id: userId },
        userId
      );

      expect(result.query).toContain('"user_id"');
      expect(result.params).toContain(userId);
    });

    it("resurrects soft-deleted rows by setting deleted_at to NULL", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "trick-1",
        { id: "trick-1", name: "Test", user_id: userId },
        userId
      );

      expect(result.query).toContain('"deleted_at" = NULL');
    });

    it("includes a WHERE clause with user_id for user-scoped tables", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "trick-1",
        { id: "trick-1", name: "Test", user_id: userId },
        userId
      );

      expect(result.query).toMatch(USER_ID_WHERE_PATTERN);
    });

    it("uses parameterized placeholders", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "trick-1",
        { id: "trick-1", name: "Test" },
        userId
      );

      expect(result.query).toContain("$1");
      expect(result.query).toContain("$2");
    });

    it("excludes id from ON CONFLICT SET clause", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "abc",
        { id: "abc", name: "Card Trick" },
        "user-1"
      );

      const onConflictPart = result.query.split("DO UPDATE SET")[1];
      expect(onConflictPart).not.toContain('"id"');
    });

    it("uses EXCLUDED references in ON CONFLICT SET clause", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "abc",
        { id: "abc", name: "Card Trick" },
        "user-1"
      );

      expect(result.query).toContain("EXCLUDED");
    });

    it("uses NOW() for updated_at in ON CONFLICT SET clause instead of client value", () => {
      const result = buildQuery(
        OpType.PUT,
        "tricks",
        "abc",
        { id: "abc", name: "Card Trick", updated_at: "2024-01-01T00:00:00Z" },
        "user-1"
      );

      const onConflictPart = result.query.split("DO UPDATE SET")[1];
      expect(onConflictPart).toContain('"updated_at" = NOW()');
      expect(onConflictPart).not.toContain('EXCLUDED."updated_at"');
    });
  });

  describe("PATCH operations", () => {
    it("generates an UPDATE with SET clauses", () => {
      const result = buildQuery(
        OpType.PATCH,
        "tricks",
        "trick-1",
        { name: "Updated Name" },
        userId
      );

      expect(result.query).toContain("UPDATE");
      expect(result.query).toContain('"tricks"');
      expect(result.query).toContain("SET");
      expect(result.query).toContain('"name"');
      expect(result.params).toContain("Updated Name");
      expect(result.params).toContain("trick-1");
    });

    it("always sets updated_at to NOW()", () => {
      const result = buildQuery(
        OpType.PATCH,
        "tricks",
        "trick-1",
        { name: "Test" },
        userId
      );

      expect(result.query).toContain('"updated_at" = NOW()');
    });

    it("scopes by user_id in the WHERE clause", () => {
      const result = buildQuery(
        OpType.PATCH,
        "tricks",
        "trick-1",
        { name: "Test" },
        userId
      );

      expect(result.query).toContain('"user_id"');
      expect(result.params).toContain(userId);
    });

    it("excludes id from SET clause", () => {
      const result = buildQuery(
        OpType.PATCH,
        "tricks",
        "abc",
        { id: "abc", name: "Updated Trick" },
        "user-1"
      );

      expect(result.query).not.toContain('SET "id"');
      expect(result.params).toEqual(["Updated Trick", "abc", "user-1"]);
    });

    it("uses NOW() for updated_at instead of client value", () => {
      const result = buildQuery(
        OpType.PATCH,
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
      expect(result.params).not.toContain("2024-01-01T00:00:00Z");
      expect(result.params).toEqual(["Updated Trick", "abc", "user-1"]);
    });
  });

  describe("DELETE operations", () => {
    it("generates a soft-delete UPDATE setting deleted_at and updated_at", () => {
      const result = buildQuery(OpType.DELETE, "tricks", "trick-1", {}, userId);

      expect(result.query).toContain("UPDATE");
      expect(result.query).toContain('"deleted_at" = NOW()');
      expect(result.query).toContain('"updated_at" = NOW()');
      expect(result.query).not.toContain("DELETE FROM");
    });

    it("scopes by id and user_id", () => {
      const result = buildQuery(OpType.DELETE, "tricks", "trick-1", {}, userId);

      expect(result.query).toContain('"id" = $1');
      expect(result.query).toContain('"user_id" = $2');
      expect(result.params).toEqual(["trick-1", userId]);
    });
  });

  describe("junction table scoping", () => {
    it("includes user_id clause for junction tables", () => {
      const result = buildQuery(
        OpType.PUT,
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

      expect(result.params).toContain("user-1");
      expect(result.query).toContain('"user_id"');
    });
  });
});
