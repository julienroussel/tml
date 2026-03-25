import type { AbstractIntlMessages } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { NeonAuthLocalizedProvider } from "@/components/neon-auth-localized-provider";
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
 * Composes DynamicIntlProvider, NeonAuthLocalizedProvider, and Toaster
 * so the provider tree is defined in one place.
 *
 * DynamicIntlProvider is outermost so NeonAuthLocalizedProvider can use
 * `useLocale()` to pass locale-aware translations to NeonAuthUIProvider.
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
    <DynamicIntlProvider initialLocale={locale} initialMessages={messages}>
      <NeonAuthLocalizedProvider>
        {children}
        <Toaster />
      </NeonAuthLocalizedProvider>
    </DynamicIntlProvider>
  );
}
