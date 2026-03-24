import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getRequestConfig: vi.fn((fn: unknown) => fn),
}));

const mockHeadersGet = vi.fn().mockReturnValue(null);
const mockCookiesGet = vi.fn().mockReturnValue(undefined);
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: mockHeadersGet })),
  cookies: vi.fn(async () => ({ get: mockCookiesGet })),
}));

vi.mock("./config", () => ({
  locales: ["en", "fr", "es", "pt", "it", "de", "nl"] as const,
  defaultLocale: "en",
  isLocale: (value: string) =>
    ["en", "fr", "es", "pt", "it", "de", "nl"].includes(value),
}));

type ConfigFn = (opts: {
  requestLocale: Promise<string | undefined>;
}) => Promise<{ locale: string; messages: unknown }>;

describe("i18n/request", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports a request config function", async () => {
    const mod = await import("./request");
    expect(mod.default).toBeTypeOf("function");
  });

  it("returns default locale when requested locale is invalid", async () => {
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/en.json", () => ({ default: { key: "value" } }));

    const result = await configFn({
      requestLocale: Promise.resolve("zz"),
    });
    // Invalid requestLocale + no cookie → falls through to Accept-Language / default
    expect(result.locale).toBe("en");
    expect(result.messages).toBeDefined();
  });

  it("reads locale from NEXT_LOCALE cookie when requestLocale is undefined", async () => {
    mockCookiesGet.mockReturnValueOnce({ value: "fr" });
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/fr.json", () => ({ default: { key: "valeur" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("fr");
  });

  it("ignores invalid NEXT_LOCALE cookie and falls back to Accept-Language", async () => {
    mockCookiesGet.mockReturnValueOnce({ value: "xx" });
    mockHeadersGet.mockReturnValueOnce("de,en;q=0.5");
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/de.json", () => ({ default: { key: "wert" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("de");
  });

  it("returns requested locale when valid", async () => {
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/fr.json", () => ({ default: { key: "valeur" } }));

    const result = await configFn({
      requestLocale: Promise.resolve("fr"),
    });
    expect(result.locale).toBe("fr");
  });

  it("negotiates locale from Accept-Language when no cookie", async () => {
    mockHeadersGet.mockReturnValueOnce("fr-FR,fr;q=0.9,en;q=0.8");
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/fr.json", () => ({ default: { key: "valeur" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("fr");
  });

  it("falls back to base language from Accept-Language", async () => {
    mockHeadersGet.mockReturnValueOnce("pt-BR,pt;q=0.9");
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/pt.json", () => ({ default: { key: "valor" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("pt");
  });

  it("returns default when Accept-Language has no supported match", async () => {
    mockHeadersGet.mockReturnValueOnce("ja-JP,ja;q=0.9,zh;q=0.8");
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/en.json", () => ({ default: { key: "value" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("en");
  });

  it("returns default when no Accept-Language header", async () => {
    mockHeadersGet.mockReturnValueOnce(null);
    const configFn = (await import("./request")).default as ConfigFn;
    vi.doMock("./messages/en.json", () => ({ default: { key: "value" } }));

    const result = await configFn({
      requestLocale: Promise.resolve(undefined),
    });
    expect(result.locale).toBe("en");
  });
});
