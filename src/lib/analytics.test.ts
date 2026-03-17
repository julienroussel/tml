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
  });
});
