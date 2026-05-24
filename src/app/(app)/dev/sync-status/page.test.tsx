import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./sync-status-debug", () => ({
  SyncStatusDebug: () => <div data-testid="sync-status-debug" />,
}));

const notFoundError = new Error("not-found");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw notFoundError;
  },
}));

describe("/dev/sync-status route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Ensures the diagnostic page is invisible anywhere that isn't a dev
  // environment. The gate is `!== "development"` (deny-list), so previews,
  // production, test, and any other value must all 404. Asserting each
  // string value pins the gate as deny-list — a regression that flipped to
  // `=== "production"` would expose the page on previews and pass an
  // explicit-prod-only test.
  it.each([
    "production",
    "preview",
    "test",
  ])("returns notFound() when NODE_ENV is %s", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.resetModules();
    const { default: Page } = await import("./page");
    await expect(Page()).rejects.toThrow(notFoundError);
  });

  // Note: a true `process.env.NODE_ENV = undefined` case cannot be reproduced
  // from a test: Node's typings mark it read-only and Vitest's runtime forces
  // it to "test". The three string values above pin the deny-list shape; a
  // future refactor that introduces an `?.toLowerCase()` would crash on
  // genuine undefined, but no realistic deployment produces that state.

  // Defense-in-depth: even with NODE_ENV=development, a non-empty VERCEL_ENV
  // must still 404. `VERCEL_ENV` is set on every Vercel environment
  // (production/preview/development) and `NODE_ENV` cannot distinguish prod
  // from preview, so this OR-arm is what blocks a hypothetical Vercel deploy
  // that somehow ran with NODE_ENV=development. A regression that drops the
  // `|| process.env.VERCEL_ENV` clause would pass every NODE_ENV-only case
  // above; this case is the one that catches it.
  it.each([
    "production",
    "preview",
    "development",
  ])("returns notFound() when NODE_ENV=development but VERCEL_ENV=%s", async (vercelEnv) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.resetModules();
    const { default: Page } = await import("./page");
    await expect(Page()).rejects.toThrow(notFoundError);
  });

  it("renders the diagnostic dump when NODE_ENV === development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { default: Page } = await import("./page");
    // Render verifies the page mounts SyncStatusDebug (mocked to expose a
    // data-testid) — a typeof check would let an import-rename regression
    // pass undetected.
    render(await Page());
    expect(screen.getByTestId("sync-status-debug")).toBeInTheDocument();
  });
});
