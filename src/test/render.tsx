import {
  type RenderOptions,
  type RenderResult,
  render,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

/**
 * Custom render wrapper with app providers.
 *
 * Note: next-intl is globally mocked in vitest.setup.ts (useTranslations returns
 * "namespace.key" strings), so NextIntlClientProvider here is the mock passthrough.
 * It's included so tests that opt out of the global mock get a real provider.
 * ThemeProvider and PowerSyncContext are omitted — they are not needed for
 * component-level tests and can be added per-test when required.
 */
function AllProviders({ children }: { children: ReactNode }): ReactElement {
  return (
    <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { renderWithProviders };
