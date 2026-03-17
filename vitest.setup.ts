import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// Global mock for next-intl — returns "namespace.key" so tests catch
// wrong-namespace usage (e.g. getTranslations("settings") vs "dashboard").
// Interpolated values are appended in parentheses.
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = Object.assign(
      (key: string, values?: Record<string, string | number>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        if (values) {
          const parts = Object.entries(values).map(
            ([k, v]) => `${k}: ${String(v)}`
          );
          return `${fullKey} (${parts.join(", ")})`;
        }
        return fullKey;
      },
      { rich: null as unknown, raw: null as unknown, markup: null as unknown }
    );
    t.rich = t;
    t.raw = t;
    t.markup = t;
    return t;
  },
  useLocale: () => "en",
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: (namespace?: string) => {
    const t = Object.assign(
      (key: string, values?: Record<string, string | number>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        if (values) {
          const parts = Object.entries(values).map(
            ([k, v]) => `${k}: ${String(v)}`
          );
          return `${fullKey} (${parts.join(", ")})`;
        }
        return fullKey;
      },
      { rich: null as unknown, raw: null as unknown, markup: null as unknown }
    );
    t.rich = t;
    t.raw = t;
    t.markup = t;
    return Promise.resolve(t);
  },
  getLocale: () => Promise.resolve("en"),
  getMessages: () => Promise.resolve({}),
}));
