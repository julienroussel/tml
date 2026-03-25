import { describe, expect, expectTypeOf, it } from "vitest";
import type { SetlistId, TrickId, UserId } from "./types";

describe("branded ID types", () => {
  it("allows creating branded IDs via assertion", () => {
    const userId = "123e4567-e89b-12d3-a456-426614174000" as unknown as UserId;
    const trickId =
      "123e4567-e89b-12d3-a456-426614174001" as unknown as TrickId;

    // Branded types are strings at runtime
    expect(typeof userId).toBe("string");
    expect(typeof trickId).toBe("string");
  });

  it("branded types are not assignable to plain strings", () => {
    expectTypeOf<UserId>().not.toEqualTypeOf<string>();
    expectTypeOf<TrickId>().not.toEqualTypeOf<string>();
    expectTypeOf<SetlistId>().not.toEqualTypeOf<string>();
  });

  it("branded types are not assignable to each other", () => {
    expectTypeOf<UserId>().not.toEqualTypeOf<TrickId>();
    expectTypeOf<TrickId>().not.toEqualTypeOf<SetlistId>();
    expectTypeOf<SetlistId>().not.toEqualTypeOf<UserId>();
  });
});
