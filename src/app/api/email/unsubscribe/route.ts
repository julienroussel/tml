import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { defaultLocale, isLocale } from "@/i18n/config";
import type { EmailTranslations } from "@/i18n/email-translations";
import { getEmailTranslations } from "@/i18n/email-translations";
import { escapeHtml, verifyUnsubscribeToken } from "@/lib/email";
import {
  foregroundHex,
  mutedForegroundHex,
  primaryForegroundHex,
  primaryHex,
} from "@/lib/email-colors";

const TRAILING_SLASHES = /\/+$/;

const CSP_HEADER =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'";

const BODY_STYLE = `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 24px; color: ${foregroundHex};`;

const BRAND_HEADER = `<div style="margin-bottom: 32px;"><p style="font-size: 14px; color: ${mutedForegroundHex}; letter-spacing: 0.2em; font-weight: 300; margin: 0 0 2px;">THE</p><p style="font-size: 24px; color: ${foregroundHex}; font-weight: 700; letter-spacing: 0.03em; margin: 0;">MAGIC LAB</p></div>`;

function htmlResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": CSP_HEADER,
    },
  });
}

function brandedPage(content: string, lang: Locale = defaultLocale): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Magic Lab</title></head>
<body style="${BODY_STYLE}">
  ${BRAND_HEADER}
  ${content}
</body>
</html>`;
}

function errorResponse(
  message: string,
  status: number,
  t?: EmailTranslations,
  lang?: Locale
): NextResponse {
  const title = t ? escapeHtml(t.errorTitle) : "Error";
  return htmlResponse(
    brandedPage(
      `<h1 style="font-size: 20px; margin: 0 0 8px;">${title}</h1><p>${escapeHtml(message)}</p>`,
      lang
    ),
    status
  );
}

function getVercelPreviewOrigin(): string | null {
  if (process.env.VERCEL_ENV === "production") {
    return null;
  }
  const vercelUrl = process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : null;
}

function hasPostgresCode(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error && "code" in error && typeof error.code === "string"
  );
}

const normalize = (url: string): string =>
  url.replace(TRAILING_SLASHES, "").toLowerCase();

function resolveLocale(raw: string | null): Locale {
  return raw && isLocale(raw) ? raw : defaultLocale;
}

/**
 * Validates the request origin against the expected app URL and Vercel preview URLs.
 * Requires the Origin header — browsers always send it on POST requests.
 * Returns the validated source origin, or a 403 NextResponse if validation fails.
 */
function validateOrigin(
  origin: string | null,
  t: EmailTranslations,
  lang: Locale
): string | NextResponse {
  if (!origin) {
    return errorResponse(t.unsubscribeErrorOrigin, 403, t, lang);
  }

  return normalize(origin);
}

/**
 * GET renders an HTML confirmation page with a form that POSTs
 * to perform the actual unsubscribe.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  const locale = resolveLocale(request.nextUrl.searchParams.get("locale"));

  let t: EmailTranslations;
  try {
    t = await getEmailTranslations(locale);
  } catch {
    return errorResponse("Something went wrong.", 500);
  }

  if (!token) {
    return errorResponse(t.unsubscribeErrorMissing, 400, t, locale);
  }

  const escapedToken = escapeHtml(token);

  return htmlResponse(
    brandedPage(
      `<h1 style="font-size: 20px; margin: 0 0 8px;">${escapeHtml(t.unsubscribeTitle)}</h1>
  <p>${escapeHtml(t.unsubscribeDescription)}</p>
  <form method="POST" action="/api/email/unsubscribe?locale=${locale}">
    <input type="hidden" name="token" value="${escapedToken}" />
    <input type="hidden" name="locale" value="${locale}" />
    <button type="submit" style="background-color: ${primaryHex}; color: ${primaryForegroundHex}; border: none; border-radius: 6px; padding: 12px 24px; min-height: 44px; min-width: 44px; font-size: 16px; cursor: pointer;">${escapeHtml(t.unsubscribeButton)}</button>
  </form>`,
      locale
    ),
    200
  );
}

/**
 * POST performs the actual unsubscribe (database update).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Resolve locale early from query param for origin validation errors.
  // The form data locale (hidden field) will be used once available.
  const queryLocale = resolveLocale(request.nextUrl.searchParams.get("locale"));

  let queryT: EmailTranslations;
  try {
    queryT = await getEmailTranslations(queryLocale);
  } catch {
    return errorResponse("Something went wrong.", 500);
  }

  // Validate origin to prevent CSRF
  const originResult = validateOrigin(
    request.headers.get("origin"),
    queryT,
    queryLocale
  );
  if (originResult instanceof NextResponse) {
    return originResult;
  }

  const expectedOrigin = normalize(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://themagiclab.app"
  );
  const previewOrigin = getVercelPreviewOrigin();
  const isVercelPreview =
    previewOrigin !== null && normalize(previewOrigin) === originResult;
  if (originResult !== expectedOrigin && !isVercelPreview) {
    return errorResponse(
      queryT.unsubscribeErrorOrigin,
      403,
      queryT,
      queryLocale
    );
  }

  // Hoist so the catch block can use the form-resolved locale/translations
  // when available, falling back to query-param values if form parsing failed.
  let locale = queryLocale;
  let t = queryT;

  try {
    const formData = await request.formData();
    const token = formData.get("token");

    // Prefer locale from form data (hidden field), fall back to query param
    const formLocaleRaw = formData.get("locale");
    locale =
      typeof formLocaleRaw === "string" && isLocale(formLocaleRaw)
        ? formLocaleRaw
        : queryLocale;
    t = locale === queryLocale ? queryT : await getEmailTranslations(locale);

    if (typeof token !== "string" || !token) {
      return errorResponse(t.unsubscribeErrorMissing, 400, t, locale);
    }

    const userId = verifyUnsubscribeToken(token);
    if (!userId) {
      return errorResponse(t.unsubscribeErrorInvalid, 400, t, locale);
    }

    const db = getDb();
    await db
      .insert(userPreferences)
      .values({ userId, emailEnabled: false })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { emailEnabled: false, updatedAt: sql`NOW()` },
      });

    return htmlResponse(
      brandedPage(
        `<h1 style="font-size: 20px; margin: 0 0 8px;">${escapeHtml(t.unsubscribeSuccess)}</h1><p>${escapeHtml(t.unsubscribeSuccessDescription)}</p>`,
        locale
      ),
      200
    );
  } catch (error: unknown) {
    // FK constraint violation (23503) means the user doesn't exist
    if (hasPostgresCode(error) && error.code === "23503") {
      return errorResponse(t.unsubscribeErrorExpired, 404, t, locale);
    }

    console.error(
      "Unsubscribe failed:",
      error instanceof Error ? error.message : String(error)
    );
    return errorResponse(t.unsubscribeErrorGeneric, 500, t, locale);
  }
}
