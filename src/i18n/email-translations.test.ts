import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getEmailTranslations, interpolate } = await import(
  "./email-translations"
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("interpolate", () => {
  it("replaces a single placeholder", () => {
    expect(interpolate("Hi {name}!", { name: "Houdini" })).toBe("Hi Houdini!");
  });

  it("replaces multiple different placeholders", () => {
    expect(
      interpolate("{greeting}, {name}!", { greeting: "Hello", name: "World" })
    ).toBe("Hello, World!");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    expect(interpolate("{x} and {x}", { x: "a" })).toBe("a and a");
  });

  it("returns the template unchanged when no values match", () => {
    expect(interpolate("Hi {name}!", {})).toBe("Hi {name}!");
  });

  it("handles empty template", () => {
    expect(interpolate("", { name: "test" })).toBe("");
  });
});

describe("getEmailTranslations", () => {
  it("loads English translations with all required keys", async () => {
    const t = await getEmailTranslations("en");

    expect(t.welcomeSubject).toBe("Welcome to The Magic Lab");
    expect(t.welcomeGreeting).toContain("{name}");
    expect(t.unsubscribeButton).toBe("Unsubscribe");
    expect(t.errorTitle).toBe("Error");
  });

  it("loads French translations", async () => {
    const t = await getEmailTranslations("fr");

    expect(t.welcomeSubject).toBe("Bienvenue sur The Magic Lab");
    expect(t.unsubscribeButton).toBe("Se désabonner");
    expect(t.errorTitle).toBe("Erreur");
  });

  it("loads translations for all supported locales", async () => {
    const locales = ["en", "fr", "es", "pt", "it", "de", "nl"] as const;

    for (const locale of locales) {
      const t = await getEmailTranslations(locale);

      // Every key must be a non-empty string
      for (const [key, value] of Object.entries(t)) {
        expect(value, `${locale}.email.${key}`).toBeTypeOf("string");
        expect(value.length, `${locale}.email.${key} is empty`).toBeGreaterThan(
          0
        );
      }
    }
  });

  it("returns translations with exactly the expected keys", async () => {
    const t = await getEmailTranslations("en");
    const keys = Object.keys(t).sort();

    expect(keys).toEqual([
      "errorTitle",
      "unsubscribeButton",
      "unsubscribeDescription",
      "unsubscribeErrorExpired",
      "unsubscribeErrorGeneric",
      "unsubscribeErrorInvalid",
      "unsubscribeErrorMissing",
      "unsubscribeErrorOrigin",
      "unsubscribeSuccess",
      "unsubscribeSuccessDescription",
      "unsubscribeTitle",
      "welcomeBody",
      "welcomeCta",
      "welcomeFeatureImprove",
      "welcomeFeaturePerform",
      "welcomeFeaturePlan",
      "welcomeFooter",
      "welcomeGreeting",
      "welcomeGreetingAnonymous",
      "welcomePreview",
      "welcomeSubject",
    ]);
  });
});

describe("getEmailTranslations fallback", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("falls back to default locale when locale file has no email namespace", async () => {
    vi.doMock("./messages/fr.json", () => ({
      default: { common: { save: "Enregistrer" } },
    }));

    const { getEmailTranslations: load } = await import("./email-translations");
    const t = await load("fr");

    expect(t.welcomeSubject).toBe("Welcome to The Magic Lab");
  });

  it("falls back to default locale when locale file import throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    vi.doMock("./messages/fr.json", () => {
      throw new Error("Module not found");
    });

    const { getEmailTranslations: load } = await import("./email-translations");
    const t = await load("fr");

    expect(t.welcomeSubject).toBe("Welcome to The Magic Lab");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load locale "fr"'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it("falls back to default locale when locale has incomplete email namespace", async () => {
    vi.doMock("./messages/fr.json", () => ({
      default: {
        email: {
          welcomeSubject: "Bienvenue",
          // Missing all other required keys
        },
      },
    }));

    const { getEmailTranslations: load } = await import("./email-translations");
    const t = await load("fr");

    // Should fall back to English since French is incomplete
    expect(t.welcomeSubject).toBe("Welcome to The Magic Lab");
  });

  it("throws when both requested and default locale have no email namespace", async () => {
    vi.doMock("./messages/fr.json", () => ({
      default: { common: {} },
    }));
    vi.doMock("./messages/en.json", () => ({
      default: { common: {} },
    }));

    const { getEmailTranslations: load } = await import("./email-translations");

    await expect(load("fr")).rejects.toThrow(
      'Email translations missing for both "fr" and default locale "en"'
    );
  });
});
