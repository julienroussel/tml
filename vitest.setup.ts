import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// Global mock for next-intl — returns "namespace.key" so tests catch
// wrong-namespace usage (e.g. getTranslations("settings") vs "dashboard").
// Interpolated values are appended in parentheses.
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      if (values) {
        const parts = Object.entries(values).map(
          ([k, v]) => `${k}: ${String(v)}`
        );
        return `${fullKey} (${parts.join(", ")})`;
      }
      return fullKey;
    };
    return Object.assign(t, { rich: t, raw: t, markup: t });
  },
  useLocale: () => "en",
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: (
    namespaceOrOpts?: string | { locale?: string; namespace?: string }
  ) => {
    const namespace =
      typeof namespaceOrOpts === "string"
        ? namespaceOrOpts
        : namespaceOrOpts?.namespace;
    const t = (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      if (values) {
        const parts = Object.entries(values).map(
          ([k, v]) => `${k}: ${String(v)}`
        );
        return `${fullKey} (${parts.join(", ")})`;
      }
      return fullKey;
    };
    return Promise.resolve(Object.assign(t, { rich: t, raw: t, markup: t }));
  },
  getLocale: () => Promise.resolve("en"),
  getMessages: () => Promise.resolve({}),
}));
