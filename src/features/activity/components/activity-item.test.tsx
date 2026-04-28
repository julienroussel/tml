import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Local mock — extends the global vitest.setup.ts mock with useFormatter
// (the global mock only stubs t/useTranslations, not useFormatter).
const relativeTimeCalls: { date: Date; reference?: number }[] = [];
vi.mock("next-intl", () => {
  const t = (key: string, values?: Record<string, string | number>) => {
    if (values) {
      const parts = Object.entries(values).map(
        ([k, v]) => `${k}: ${String(v)}`
      );
      return `${key} (${parts.join(", ")})`;
    }
    return key;
  };
  return {
    useTranslations: () => Object.assign(t, { rich: t, raw: t, markup: t }),
    useFormatter: () => ({
      relativeTime: (date: Date, reference?: number) => {
        relativeTimeCalls.push({ date, reference });
        const ref = reference ?? Date.now();
        return `${Math.floor((ref - date.getTime()) / 1000)}s ago`;
      },
    }),
    useLocale: () => "en",
    useMessages: () => ({}),
  };
});

import { asTrickId, asUserId } from "@/db/types";
import type { ParsedEvent } from "../types";
import { ActivityItem } from "./activity-item";

const TRICK_CREATED_KEY_RE = /activity\.events\.trick_created/;

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: "event-1",
    userId: asUserId("user-1"),
    eventType: "trick.created",
    entityType: "trick",
    entityId: asTrickId("trick-1"),
    payload: { name: "Card Warp", status: "new", category: null },
    source: "client",
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

describe("ActivityItem", () => {
  it("renders the i18n key used to label the event", () => {
    render(<ActivityItem event={makeEvent()} />);
    // The next-intl mock in vitest.setup.ts returns "<key> (k: v)" so the
    // label key + values are visible in the rendered output.
    expect(screen.getByText(TRICK_CREATED_KEY_RE)).toBeDefined();
  });

  it("renders a relative time element for the createdAt timestamp", () => {
    const event = makeEvent();
    const { container } = render(<ActivityItem event={event} />);
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time?.getAttribute("dateTime")).toBe(event.createdAt);
  });

  it("renders as a list item so it slots into <ol>", () => {
    const { container } = render(<ActivityItem event={makeEvent()} />);
    expect(container.querySelector("li")).not.toBeNull();
  });

  it("renders a per-entity icon (different svg for trick vs item)", () => {
    const { container: trickContainer } = render(
      <ActivityItem event={makeEvent({ entityType: "trick" })} />
    );
    const { container: itemContainer } = render(
      <ActivityItem
        event={makeEvent({
          eventType: "item.created",
          entityType: "item",
          payload: { name: "Top Hat" },
        })}
      />
    );
    const trickSvg = trickContainer.querySelector("svg");
    const itemSvg = itemContainer.querySelector("svg");
    // Both icons should render — and they must differ so users can
    // visually distinguish entity kinds in the feed.
    expect(trickSvg).not.toBeNull();
    expect(itemSvg).not.toBeNull();
    expect(trickSvg?.outerHTML).not.toBe(itemSvg?.outerHTML);
  });

  it("trims trailing whitespace when payload.name is empty", () => {
    // trick.deleted snapshots no name in the event_type fallback path; the
    // rendered text must not end with a stray space from the empty {name}
    // interpolation.
    const { container } = render(
      <ActivityItem
        event={makeEvent({
          eventType: "trick.deleted",
          payload: { name: "" },
        })}
      />
    );
    const paragraph = container.querySelector("p");
    expect(paragraph).not.toBeNull();
    const text = paragraph?.textContent ?? "";
    expect(text).toBe(text.trim());
    expect(text.endsWith(" ")).toBe(false);
  });

  it("forwards the `now` prop as the reference passed to relativeTime", () => {
    relativeTimeCalls.length = 0;
    const event = makeEvent();
    const reference = Date.parse(event.createdAt) + 5000;
    render(<ActivityItem event={event} now={reference} />);
    const lastCall = relativeTimeCalls.at(-1);
    expect(lastCall?.reference).toBe(reference);
    expect(lastCall?.date.toISOString()).toBe(event.createdAt);
  });
});
