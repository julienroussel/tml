import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { escapeHtml, verifyUnsubscribeToken } from "@/lib/email";

const TRAILING_SLASHES = /\/+$/;

const CSP_HEADER =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'";

const BODY_STYLE =
  'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 24px; color: #374151;';

const BRAND_HEADER =
  '<div style="margin-bottom: 32px;"><p style="font-size: 14px; color: #6b7280; letter-spacing: 0.2em; font-weight: 300; margin: 0 0 2px;">THE</p><p style="font-size: 24px; color: #111827; font-weight: 700; letter-spacing: 0.03em; margin: 0;">MAGIC LAB</p></div>';

function htmlResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": CSP_HEADER,
    },
  });
}

function brandedPage(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Magic Lab</title></head>
<body style="${BODY_STYLE}">
  ${BRAND_HEADER}
  ${content}
</body>
</html>`;
}

function errorResponse(message: string, status: number): NextResponse {
  return htmlResponse(
    brandedPage(
      `<h1 style="font-size: 20px; margin: 0 0 8px;">Error</h1><p>${message}</p>`
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

/**
 * Validates the request origin against the expected app URL and Vercel preview URLs.
 * Requires the Origin header — browsers always send it on POST requests.
 * Returns the validated source origin, or a 403 NextResponse if validation fails.
 */
function validateOrigin(origin: string | null): string | NextResponse {
  if (!origin) {
    return errorResponse("Invalid request origin.", 403);
  }

  return normalize(origin);
}

/**
 * GET renders an HTML confirmation page with a form that POSTs
 * to perform the actual unsubscribe.
 */
export function GET(request: NextRequest): NextResponse {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return errorResponse("Missing unsubscribe token.", 400);
  }

  const escapedToken = escapeHtml(token);

  return htmlResponse(
    brandedPage(`<h1 style="font-size: 20px; margin: 0 0 8px;">Unsubscribe from email notifications</h1>
  <p>Click the button below to confirm you want to unsubscribe.</p>
  <form method="POST" action="/api/email/unsubscribe">
    <input type="hidden" name="token" value="${escapedToken}" />
    <button type="submit" style="background-color: #7c3aed; color: #fff; border: none; border-radius: 6px; padding: 12px 24px; min-height: 44px; min-width: 44px; font-size: 16px; cursor: pointer;">Unsubscribe</button>
  </form>`),
    200
  );
}

/**
 * POST performs the actual unsubscribe (database update).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Validate origin to prevent CSRF
  const originResult = validateOrigin(request.headers.get("origin"));
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
    return errorResponse("Invalid request origin.", 403);
  }

  try {
    const formData = await request.formData();
    const token = formData.get("token");

    if (typeof token !== "string" || !token) {
      return errorResponse("Missing unsubscribe token.", 400);
    }

    const userId = verifyUnsubscribeToken(token);
    if (!userId) {
      return errorResponse("Invalid token.", 400);
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
        '<h1 style="font-size: 20px; margin: 0 0 8px;">Unsubscribed</h1><p>You have been unsubscribed from email notifications.</p>'
      ),
      200
    );
  } catch (error: unknown) {
    // FK constraint violation (23503) means the user doesn't exist
    if (hasPostgresCode(error) && error.code === "23503") {
      return errorResponse("Invalid or expired token.", 404);
    }

    console.error(
      "Unsubscribe failed:",
      error instanceof Error ? error.message : String(error)
    );
    return errorResponse("Failed to unsubscribe. Please try again later.", 500);
  }
}
