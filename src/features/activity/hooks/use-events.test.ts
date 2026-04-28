import { describe, expect, it } from "vitest";
import type { EventRow } from "../types";
import { buildEventsQuery, parseEventRow } from "./use-events";

describe("buildEventsQuery", () => {
  it("filters by deleted_at IS NULL and orders newest first by default", () => {
    const { sql, params } = buildEventsQuery({});
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(sql).toContain("LIMIT 200");
    expect(params).toEqual([]);
  });

  it("adds an event_type filter when provided", () => {
    const { sql, params } = buildEventsQuery({ eventType: "trick.created" });
    expect(sql).toContain("event_type = ?");
    expect(params).toEqual(["trick.created"]);
  });

  it("adds an entity_type filter when provided", () => {
    const { sql, params } = buildEventsQuery({ entityType: "item" });
    expect(sql).toContain("entity_type = ?");
    expect(params).toEqual(["item"]);
  });

  it("respects custom limit", () => {
    const { sql } = buildEventsQuery({ limit: 5 });
    expect(sql).toContain("LIMIT 5");
  });

  it("clamps non-finite limit to default", () => {
    expect(buildEventsQuery({ limit: Number.NaN }).sql).toContain("LIMIT 200");
    expect(buildEventsQuery({ limit: Number.POSITIVE_INFINITY }).sql).toContain(
      "LIMIT 200"
    );
  });

  it("clamps non-positive or fractional limit to a safe integer", () => {
    expect(buildEventsQuery({ limit: 0 }).sql).toContain("LIMIT 1");
    expect(buildEventsQuery({ limit: -10 }).sql).toContain("LIMIT 1");
    expect(buildEventsQuery({ limit: 7.9 }).sql).toContain("LIMIT 7");
  });

  it("combines filters with AND", () => {
    const { sql, params } = buildEventsQuery({
      eventType: "item.deleted",
      entityType: "item",
      limit: 10,
    });
    expect(sql).toContain(
      "deleted_at IS NULL AND event_type = ? AND entity_type = ?"
    );
    expect(params).toEqual(["item.deleted", "item"]);
    expect(sql).toContain("LIMIT 10");
  });
});

describe("parseEventRow", () => {
  function makeRow(overrides: Partial<EventRow> = {}): EventRow {
    return {
      id: "event-1",
      user_id: "user-1",
      event_type: "trick.created",
      entity_type: "trick",
      entity_id: "trick-1",
      payload: '{"name":"Card Warp"}',
      source: "client",
      created_at: "2026-04-01T12:00:00.000Z",
      updated_at: "2026-04-01T12:00:00.000Z",
      deleted_at: null,
      ...overrides,
    };
  }

  it("parses payload JSON string into an object", () => {
    const parsed = parseEventRow(makeRow());
    expect(parsed?.payload).toEqual({ name: "Card Warp" });
  });

  it("returns empty payload for malformed JSON", () => {
    const parsed = parseEventRow(makeRow({ payload: "not json" }));
    expect(parsed?.payload).toEqual({});
  });

  it("rejects non-object JSON (arrays, primitives)", () => {
    expect(parseEventRow(makeRow({ payload: "[1,2]" }))?.payload).toEqual({});
    expect(parseEventRow(makeRow({ payload: '"str"' }))?.payload).toEqual({});
    expect(parseEventRow(makeRow({ payload: "42" }))?.payload).toEqual({});
  });

  it("normalises source to a known literal", () => {
    expect(parseEventRow(makeRow({ source: "server" }))?.source).toBe("server");
    expect(parseEventRow(makeRow({ source: "anything-else" }))?.source).toBe(
      "client"
    );
  });

  it("preserves entity_type and entity_id null values", () => {
    const parsed = parseEventRow(
      makeRow({ entity_type: null, entity_id: null })
    );
    expect(parsed?.entityType).toBeNull();
    expect(parsed?.entityId).toBeNull();
  });
});
