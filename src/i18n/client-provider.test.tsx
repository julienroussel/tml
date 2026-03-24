import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DynamicIntlProvider, useLocaleSwitch } from "./client-provider";
import type { Locale } from "./config";

// Unmock next-intl so we can test real message resolution
vi.unmock("next-intl");

const SWITCH_TO_FR_PATTERN = /switch to fr/i;

const EN_MESSAGES = { common: { save: "Save" } };

/**
 * Test helper that exposes switchLocale via a button.
 * Clicking the button switches to the given target locale.
 */
function LocaleSwitchTester({
  targetLocale,
}: {
  targetLocale: Locale;
}): ReactElement {
  const { switchLocale } = useLocaleSwitch();
  return (
    <button onClick={() => switchLocale(targetLocale)} type="button">
      Switch to {targetLocale}
    </button>
  );
}

/** Renders a translated string so we can verify the locale actually changed. */
function TranslatedSave(): ReactElement {
  const t = useTranslations("common");
  return <p data-testid="translated">{t("save")}</p>;
}

describe("DynamicIntlProvider", () => {
  it("renders children with initial locale", () => {
    render(
      <DynamicIntlProvider initialLocale="en" initialMessages={EN_MESSAGES}>
        <p>Hello world</p>
      </DynamicIntlProvider>
    );

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("sets document lang to initialLocale on mount", () => {
    document.documentElement.lang = "en";

    render(
      <DynamicIntlProvider initialLocale="fr" initialMessages={EN_MESSAGES}>
        <p>Bonjour</p>
      </DynamicIntlProvider>
    );

    expect(document.documentElement.lang).toBe("fr");
  });

  it("switchLocale updates messages via context", async () => {
    const user = userEvent.setup();

    render(
      <DynamicIntlProvider initialLocale="en" initialMessages={EN_MESSAGES}>
        <TranslatedSave />
        <LocaleSwitchTester targetLocale="fr" />
      </DynamicIntlProvider>
    );

    // Initially shows English
    expect(screen.getByTestId("translated")).toHaveTextContent("Save");

    await user.click(
      screen.getByRole("button", { name: SWITCH_TO_FR_PATTERN })
    );

    // After switch, shows French
    expect(screen.getByTestId("translated")).toHaveTextContent("Enregistrer");

    expect(document.documentElement.lang).toBe("fr");
  });
});

describe("useLocaleSwitch default context", () => {
  it("returns a no-op switchLocale outside of DynamicIntlProvider", () => {
    let capturedSwitchLocale: ((locale: Locale) => void) | undefined;

    function DefaultContextConsumer(): ReactElement {
      const { switchLocale } = useLocaleSwitch();
      capturedSwitchLocale = switchLocale;
      return <p>No provider</p>;
    }

    // Wrap in NextIntlClientProvider (not DynamicIntlProvider) so the React
    // tree renders, but useLocaleSwitch gets the default context value.
    render(
      <NextIntlClientProvider locale="en" messages={EN_MESSAGES}>
        <DefaultContextConsumer />
      </NextIntlClientProvider>
    );

    expect(screen.getByText("No provider")).toBeInTheDocument();
    // Default context switchLocale should be callable without throwing
    expect(capturedSwitchLocale).toBeDefined();
    expect(() => capturedSwitchLocale?.("fr")).not.toThrow();
  });
});
