import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getRequestConfig: vi.fn((fn: unknown) => fn),
}));

vi.mock("./config", () => ({
  locales: ["en", "fr"] as const,
  defaultLocale: "en",
}));

describe("i18n/request", () => {
  it("exports a request config function", async () => {
    const mod = await import("./request");
    expect(mod.default).toBeTypeOf("function");
  });

  it("returns default locale when requested locale is invalid", async () => {
    const configFn = (await import("./request")).default as (opts: {
      requestLocale: Promise<string | undefined>;
    }) => Promise<{ locale: string; messages: unknown }>;

    vi.doMock("./messages/en.json", () => ({ default: { key: "value" } }));

    const result = await configFn({
      requestLocale: Promise.resolve("zz"),
    });
    expect(result.locale).toBe("en");
    expect(result.messages).toBeDefined();
  });

  it("returns requested locale when valid", async () => {
    const configFn = (await import("./request")).default as (opts: {
      requestLocale: Promise<string | undefined>;
    }) => Promise<{ locale: string; messages: unknown }>;

    vi.doMock("./messages/fr.json", () => ({ default: { key: "valeur" } }));

    const result = await configFn({
      requestLocale: Promise.resolve("fr"),
    });
    expect(result.locale).toBe("fr");
  });

  it("returns default locale when requestLocale is undefined", async () => {
    const configFn = (await import("./request")).default as (opts: {
      requestLocale: Promise<string | undefined>;
    }) => Promise<{ locale: string; messages: unknown }>;

    vi.doMock("./messages/en.json", () => ({ default: { key: "value" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("en");
  });
});
