import { describe, expect, it } from "vitest";
// biome-ignore lint/performance/noNamespaceImport: testing all exports from barrel file
import * as schema from "./index";

describe("database schema exports", () => {
  it("exports all table definitions", () => {
    expect(schema.users).toBeDefined();
    expect(schema.tricks).toBeDefined();
    expect(schema.routines).toBeDefined();
    expect(schema.routineTricks).toBeDefined();
    expect(schema.practiceSessions).toBeDefined();
    expect(schema.practiceSessionTricks).toBeDefined();
    expect(schema.performances).toBeDefined();
    expect(schema.items).toBeDefined();
    expect(schema.itemTricks).toBeDefined();
    expect(schema.goals).toBeDefined();
    expect(schema.pushSubscriptions).toBeDefined();
    expect(schema.userPreferences).toBeDefined();
  });
});
