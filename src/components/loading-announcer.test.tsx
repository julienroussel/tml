import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingAnnouncer } from "./loading-announcer";

describe("LoadingAnnouncer", () => {
  it("renders a polite, atomic status live region", () => {
    render(<LoadingAnnouncer message="Loading…" />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
  });

  it("announces the provided message", () => {
    render(<LoadingAnnouncer message="Loading trick…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading trick…");
  });

  it("renders the region empty for an empty message", () => {
    render(<LoadingAnnouncer message="" />);

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("preserves the live-region node when the message changes", () => {
    const { rerender } = render(<LoadingAnnouncer message="Loading trick…" />);
    const initial = screen.getByRole("status");

    // A content change must mutate the same node, never remount it — a remount
    // would risk re-announcing stale text or being skipped by some readers.
    rerender(<LoadingAnnouncer message="Trick ready to edit." />);
    expect(screen.getByRole("status")).toBe(initial);
    expect(initial).toHaveTextContent("Trick ready to edit.");

    rerender(<LoadingAnnouncer message="" />);
    expect(screen.getByRole("status")).toBe(initial);
  });

  it("delivers the message as a mutation on the mounted region, not as content at mount", () => {
    // Two-tick render (issue #295 caveat 1): the <span> mounts empty and the
    // text arrives on a later commit. Proof = a DOM mutation that targets the
    // live region itself (or a text node inside it) — i.e. the text was added
    // AFTER the span was in the DOM. Content-at-mount would instead insert the
    // span with its text already inline, producing no span-targeted mutation.
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => {
      records.push(...batch);
    });
    observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    render(<LoadingAnnouncer message="Loading trick…" />);

    records.push(...observer.takeRecords());
    observer.disconnect();

    const region = screen.getByRole("status");
    const textArrivedAfterMount = records.some((record) => {
      if (record.type === "characterData") {
        return record.target.parentNode === region;
      }
      return record.type === "childList" && record.target === region;
    });
    expect(textArrivedAfterMount).toBe(true);
  });
});
