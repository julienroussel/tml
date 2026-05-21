import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// next-intl test mock — `t` returns "namespace.key" so tests catch
// wrong-namespace usage; interpolated values are appended in parentheses.
//
// The per-namespace `t` is MEMOIZED (issue #290) so useTranslations("collect")
// returns a referentially-stable `t` across rerenders. Effects that depend on
// `t` (the relations-error toast in collect-view / repertoire-view) must not
// refire on a no-op rerender — the idempotency tests assert that with strict
// equality, and a fresh-`t`-per-call mock silently breaks them. The caches are
// cleared after every test (below) to avoid cross-test reference bleed.
const { tClientCache, tServerCache, getClientT, getServerT } = vi.hoisted(
  () => {
    const makeT = (namespace?: string) => {
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
    };

    type CachedTranslator = ReturnType<typeof makeT>;
    const tClientCache = new Map<string, CachedTranslator>();
    const tServerCache = new Map<string, CachedTranslator>();

    const cached = (
      cache: Map<string, CachedTranslator>,
      namespace?: string
    ): CachedTranslator => {
      const key = namespace ?? "";
      const existing = cache.get(key);
      if (existing) {
        return existing;
      }
      const created = makeT(namespace);
      cache.set(key, created);
      return created;
    };

    return {
      tClientCache,
      tServerCache,
      getClientT: (namespace?: string) => cached(tClientCache, namespace),
      getServerT: (namespace?: string) => cached(tServerCache, namespace),
    };
  }
);

afterEach(cleanup);

// Drop memoized translators so each test starts with fresh `t` references.
afterEach(() => {
  tClientCache.clear();
  tServerCache.clear();
});

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => getClientT(namespace),
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
    return Promise.resolve(getServerT(namespace));
  },
  getLocale: () => Promise.resolve("en"),
  getMessages: () => Promise.resolve({}),
}));
