import "server-only";
import type { Locale } from "./config";
import { defaultLocale } from "./config";

const EMAIL_KEYS = [
  "errorTitle",
  "unsubscribeButton",
  "unsubscribeDescription",
  "unsubscribeErrorExpired",
  "unsubscribeErrorGeneric",
  "unsubscribeErrorInvalid",
  "unsubscribeErrorMissing",
  "unsubscribeErrorOrigin",
  "unsubscribeSuccess",
  "unsubscribeSuccessDescription",
  "unsubscribeTitle",
  "welcomeBody",
  "welcomeCta",
  "welcomeFeatureImprove",
  "welcomeFeaturePlan",
  "welcomeFeaturePerform",
  "welcomeFooter",
  "welcomeGreeting",
  "welcomeGreetingAnonymous",
  "welcomePreview",
  "welcomeSubject",
] as const;

type EmailTranslations = Record<(typeof EMAIL_KEYS)[number], string>;

/**
 * Replaces `{key}` placeholders in a template string with corresponding values.
 * Only handles simple string replacement — no ICU message format.
 */
function interpolate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

async function loadEmailNamespace(
  locale: Locale
): Promise<Record<string, unknown>> {
  try {
    const imported: { default: Record<string, unknown> } = await import(
      `./messages/${locale}.json`
    );
    const email = imported.default.email;
    if (email && typeof email === "object") {
      return email as Record<string, unknown>;
    }
    return {};
  } catch (error: unknown) {
    console.warn(
      `[email-translations] Failed to load locale "${locale}":`,
      error instanceof Error ? error.message : String(error)
    );
    return {};
  }
}

function extractTranslations(
  namespace: Record<string, unknown>
): EmailTranslations | null {
  const result: Partial<EmailTranslations> = {};
  for (const key of EMAIL_KEYS) {
    const value = namespace[key];
    if (typeof value !== "string") {
      return null;
    }
    result[key] = value;
  }
  return result as EmailTranslations;
}

/**
 * Load email translations for a given locale.
 * Falls back to the default locale if the requested locale's email
 * namespace is missing or incomplete.
 */
async function getEmailTranslations(
  locale: Locale
): Promise<EmailTranslations> {
  const namespace = await loadEmailNamespace(locale);
  const translations = extractTranslations(namespace);
  if (translations) {
    return translations;
  }

  // Fallback to default locale
  const fallbackNamespace = await loadEmailNamespace(defaultLocale);
  const fallback = extractTranslations(fallbackNamespace);
  if (fallback) {
    return fallback;
  }

  throw new Error(
    `Email translations missing for both "${locale}" and default locale "${defaultLocale}"`
  );
}

export type { EmailTranslations };
export { getEmailTranslations, interpolate };
