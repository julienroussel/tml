import { beforeEach, describe, expect, it, vi } from "vitest";
import { asTrickId, asUserId } from "@/db/types";
import type { ParsedEvent } from "../types";
import {
  __resetWarnedTypesForTest,
  formatEvent,
  getEntityIconKey,
} from "./format-event";

beforeEach(() => {
  __resetWarnedTypesForTest();
});

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: "event-1",
    userId: asUserId("user-1"),
    eventType: "trick.created",
    entityType: "trick",
    entityId: asTrickId("trick-1"),
    payload: {},
    source: "client",
    createdAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("formatEvent", () => {
  it("picks the right labelKey for trick.created", () => {
    const result = formatEvent(
      makeEvent({
        eventType: "trick.created",
        payload: { name: "Card Warp", status: "new", category: null },
      })
    );
    expect(result.labelKey).toBe("activity.events.trick_created");
    expect(result.values).toEqual({ name: "Card Warp" });
  });

  it("emits the name for item.created and ignores the payload type", () => {
    const result = formatEvent(
      makeEvent({
        eventType: "item.created",
        entityType: "item",
        payload: { name: "Top Hat", type: "prop" },
      })
    );
    expect(result.labelKey).toBe("activity.events.item_created");
    expect(result.values).toEqual({ name: "Top Hat" });
  });

  it("falls back to a generic label for unknown event types", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      // suppress noise from the deliberate unknown branch under test
    });
    const result = formatEvent(
      makeEvent({
        eventType: "future.event",
        entityType: null,
      })
    );
    expect(result.labelKey).toBe("activity.events.unknown");
    expect(result.values).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      "Unknown event type in activity feed:",
      "future.event"
    );
    warn.mockRestore();
  });

  it("handles missing payload fields without throwing", () => {
    const result = formatEvent(
      makeEvent({
        eventType: "trick.deleted",
        payload: {},
      })
    );
    expect(result.labelKey).toBe("activity.events.trick_deleted");
    expect(result.values).toEqual({ name: "" });
  });

  it("emits theme + locale for settings events", () => {
    expect(
      formatEvent(
        makeEvent({
          eventType: "settings.theme_changed",
          payload: { theme: "dark" },
        })
      ).values
    ).toEqual({ theme: "dark" });
    expect(
      formatEvent(
        makeEvent({
          eventType: "settings.locale_changed",
          payload: { locale: "fr" },
        })
      ).values
    ).toEqual({ locale: "fr" });
  });
});

describe("getEntityIconKey", () => {
  it("returns the entity_type when known", () => {
    expect(getEntityIconKey(makeEvent({ entityType: "tag" }))).toBe("tag");
    expect(getEntityIconKey(makeEvent({ entityType: "item" }))).toBe("item");
  });

  it("returns 'default' when entity_type is null", () => {
    expect(getEntityIconKey(makeEvent({ entityType: null }))).toBe("default");
  });

  it("returns 'default' for unknown entity_type", () => {
    expect(getEntityIconKey(makeEvent({ entityType: "weird" }))).toBe(
      "default"
    );
  });
});
