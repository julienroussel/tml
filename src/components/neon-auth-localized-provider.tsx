"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { useMessages } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { authClient } from "@/auth/client";
import { extractAuthLocalization } from "@/i18n/auth-localization";

interface NeonAuthLocalizedProviderProps {
  children: ReactNode;
}

/**
 * Wraps NeonAuthUIProvider with locale-aware translations.
 *
 * Must be rendered inside DynamicIntlProvider so `useMessages()` returns
 * the reactive messages (updates instantly on client-side language switch).
 *
 * Reads the `auth` namespace from the current locale's message bundle
 * and passes it as the `localization` prop to NeonAuthUIProvider.
 */
export function NeonAuthLocalizedProvider({
  children,
}: NeonAuthLocalizedProviderProps): ReactElement {
  const messages = useMessages();
  const localization = extractAuthLocalization(messages);

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      emailOTP
      localization={localization}
      social={{ providers: ["google"] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
