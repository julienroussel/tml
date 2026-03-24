import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import type { AbstractIntlMessages } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { authClient } from "@/auth/client";
import { Toaster } from "@/components/ui/sonner";
import { DynamicIntlProvider } from "@/i18n/client-provider";
import type { Locale } from "@/i18n/config";

interface ProvidersProps {
  children: ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
}

/**
 * Shared provider wrapper used by marketing, app, and auth layouts.
 * Composes NeonAuthUIProvider, DynamicIntlProvider, and Toaster
 * so the provider tree is defined in one place.
 *
 * ThemeProvider lives in the root layout (`src/app/layout.tsx`) to avoid
 * remount on cross-group navigation — next-themes injects a `<script>` that
 * React warns about when mounted client-side.
 */
export function Providers({
  children,
  locale,
  messages,
}: ProvidersProps): ReactElement {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      emailOTP
      social={{ providers: ["google"] }}
    >
      <DynamicIntlProvider initialLocale={locale} initialMessages={messages}>
        {children}
        <Toaster />
      </DynamicIntlProvider>
    </NeonAuthUIProvider>
  );
}
