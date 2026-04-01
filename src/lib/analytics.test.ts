import { afterEach, describe, expect, it, vi } from "vitest";

const mockTrack = vi.fn();
vi.mock("@vercel/analytics", () => ({
  track: mockTrack,
}));

describe("analytics", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("trackEvent", () => {
    it("calls track with event name only for property-less events", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("push_notifications_enabled");

      expect(mockTrack).toHaveBeenCalledWith("push_notifications_enabled");
    });

    it("calls track with event name and properties", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("theme_changed", { theme: "dark" });

      expect(mockTrack).toHaveBeenCalledWith("theme_changed", {
        theme: "dark",
      });
    });

    it("calls track for push_notifications_disabled event", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("push_notifications_disabled");

      expect(mockTrack).toHaveBeenCalledWith("push_notifications_disabled");
    });

    it("passes light theme correctly", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("theme_changed", { theme: "light" });

      expect(mockTrack).toHaveBeenCalledWith("theme_changed", {
        theme: "light",
      });
    });

    it("fires trick_created with category and status", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("trick_created", { category: "Card", status: "new" });

      expect(mockTrack).toHaveBeenCalledWith("trick_created", {
        category: "Card",
        status: "new",
      });
    });

    it("fires trick_created with null category", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("trick_created", { category: null, status: "learning" });

      expect(mockTrack).toHaveBeenCalledWith("trick_created", {
        category: null,
        status: "learning",
      });
    });

    it("fires trick_updated without properties", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("trick_updated");

      expect(mockTrack).toHaveBeenCalledWith("trick_updated");
    });

    it("fires trick_deleted without properties", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("trick_deleted");

      expect(mockTrack).toHaveBeenCalledWith("trick_deleted");
    });

    it("fires tag_created without properties", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      trackEvent("tag_created");

      expect(mockTrack).toHaveBeenCalledWith("tag_created");
    });
  });
});
