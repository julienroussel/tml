import { describe, expect, it } from "vitest";
import { extractAuthLocalization } from "./auth-localization";

describe("extractAuthLocalization", () => {
  it("extracts the auth namespace from a messages bundle", () => {
    const messages = {
      auth: {
        SIGN_IN: "Connexion",
        SIGN_UP: "Inscription",
      },
      common: {
        save: "Enregistrer",
      },
    };

    const result = extractAuthLocalization(messages);
    expect(result).toEqual({ SIGN_IN: "Connexion", SIGN_UP: "Inscription" });
  });

  it("returns empty object when auth namespace is missing", () => {
    const messages = { common: { save: "Save" } };
    const result = extractAuthLocalization(messages);
    expect(result).toEqual({});
  });

  it("returns empty object when auth namespace is not an object", () => {
    const messages = { auth: "invalid" };
    const result = extractAuthLocalization(messages);
    expect(result).toEqual({});
  });

  it("returns empty object for empty messages", () => {
    const result = extractAuthLocalization({});
    expect(result).toEqual({});
  });

  it("filters out non-string values from auth namespace", () => {
    // Simulate runtime data where a value is not a string
    const messages = {
      auth: {
        SIGN_IN: 123 as unknown as string,
        SIGN_UP: "Inscription",
      },
    };
    const result = extractAuthLocalization(messages);
    expect(result).toEqual({ SIGN_UP: "Inscription" });
  });

  it("filters out unknown keys not in AUTH_KEYS", () => {
    const messages = {
      auth: {
        SIGN_IN: "Connexion",
        UNKNOWN_KEY: "ignored",
      },
    };
    const result = extractAuthLocalization(messages);
    expect(result).toEqual({ SIGN_IN: "Connexion" });
  });
});
