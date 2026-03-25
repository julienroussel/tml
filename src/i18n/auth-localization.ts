import type { AuthLocalization } from "@neondatabase/auth/react";
import type { AbstractIntlMessages } from "next-intl";

/** Known AuthLocalization keys used by NeonAuthUIProvider. */
const AUTH_KEYS: ReadonlySet<keyof AuthLocalization> = new Set<
  keyof AuthLocalization
>([
  "SIGN_IN",
  "SIGN_IN_ACTION",
  "SIGN_IN_DESCRIPTION",
  "SIGN_UP",
  "SIGN_UP_ACTION",
  "SIGN_UP_DESCRIPTION",
  "EMAIL",
  "EMAIL_PLACEHOLDER",
  "EMAIL_REQUIRED",
  "EMAIL_OTP",
  "EMAIL_OTP_SEND_ACTION",
  "EMAIL_OTP_VERIFY_ACTION",
  "EMAIL_OTP_DESCRIPTION",
  "EMAIL_OTP_VERIFICATION_SENT",
  "ONE_TIME_PASSWORD",
  "SIGN_IN_WITH",
  "OR_CONTINUE_WITH",
  "CONTINUE",
  "GO_BACK",
  "CANCEL",
  "ALREADY_HAVE_AN_ACCOUNT",
  "DONT_HAVE_AN_ACCOUNT",
  "REMEMBER_ME",
  "PASSWORD",
  "PASSWORD_PLACEHOLDER",
  "FORGOT_PASSWORD_LINK",
  "SIGN_OUT",
]);

function isAuthKey(key: string): key is keyof AuthLocalization {
  return AUTH_KEYS.has(key as keyof AuthLocalization);
}

/**
 * Extract the `auth` namespace from a next-intl messages bundle and return
 * only known AuthLocalization keys with validated string values.
 */
function extractAuthLocalization(
  messages: AbstractIntlMessages
): Partial<AuthLocalization> {
  const authMessages = messages.auth;
  if (!authMessages || typeof authMessages !== "object") {
    return {};
  }
  const result: Partial<AuthLocalization> = {};
  for (const [key, value] of Object.entries(authMessages)) {
    if (isAuthKey(key) && typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

export { extractAuthLocalization };
