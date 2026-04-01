"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Locale } from "./config";

// All locale messages bundled at build time for offline access.
// ~5KB each × 7 locales ≈ 35KB uncompressed, ~8KB gzipped.
import de from "./messages/de.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import it from "./messages/it.json";
import nl from "./messages/nl.json";
import pt from "./messages/pt.json";

const ALL_MESSAGES: Record<Locale, AbstractIntlMessages> = {
  de,
  en,
  es,
  fr,
  it,
  nl,
  pt,
};

interface IntlContextValue {
  /** Switch the active locale client-side without a server round-trip. */
  switchLocale: (locale: Locale) => void;
}

const IntlContext = createContext<IntlContextValue>({
  // biome-ignore lint/suspicious/noEmptyBlockStatements: default no-op — overridden by DynamicIntlProvider
  switchLocale: () => {},
});

/**
 * Returns the client-side locale switcher.
 * Use this to change language instantly (offline-capable).
 */
export function useLocaleSwitch(): IntlContextValue {
  return useContext(IntlContext);
}

interface DynamicIntlProviderProps {
  children: ReactNode;
  initialLocale: Locale;
  initialMessages: AbstractIntlMessages;
}

/**
 * Client-side i18n provider that wraps NextIntlClientProvider and supports
 * instant locale switching without a server round-trip.
 *
 * On initial render, uses the server-provided locale and messages (SSR-safe).
 * When `switchLocale` is called, swaps messages from the bundled map and
 * re-renders all client components in the new language immediately.
 */
export function DynamicIntlProvider({
  children,
  initialLocale,
  initialMessages,
}: DynamicIntlProviderProps): ReactElement {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [messages, setMessages] =
    useState<AbstractIntlMessages>(initialMessages);

  function switchLocale(newLocale: Locale): void {
    const newMessages = ALL_MESSAGES[newLocale];
    setLocale(newLocale);
    setMessages(newMessages);
  }

  // Keep a ref to the latest switchLocale so the context value object is stable.
  // React Compiler cannot optimise Context.Provider values, so a new object
  // every render would force all useLocaleSwitch() consumers to re-render.
  const switchLocaleRef = useRef(switchLocale);
  switchLocaleRef.current = switchLocale;
  const stableContext = useRef<IntlContextValue>({
    switchLocale: (newLocale: Locale) => switchLocaleRef.current(newLocale),
  });

  // Secondary sync: keeps <html lang> correct when the user switches
  // locale client-side (e.g., via settings). The primary sync is the
  // blocking inline script in the root layout (src/lib/lang-script.ts)
  // which handles initial page load before hydration.
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return (
    <IntlContext.Provider value={stableContext.current}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="UTC"
      >
        {children}
      </NextIntlClientProvider>
    </IntlContext.Provider>
  );
}
