import crypto from "node:crypto";
import "server-only";
import { render } from "@react-email/render";
import { createElement } from "react";
import { Resend } from "resend";
import WelcomeEmail from "@/emails/welcome";

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  if (!cachedClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

let cachedHmacSecret: Buffer | null = null;

function getHmacSecret(): Buffer {
  if (cachedHmacSecret) {
    return cachedHmacSecret;
  }
  const secret = process.env.EMAIL_HMAC_SECRET;
  if (!secret) {
    throw new Error("EMAIL_HMAC_SECRET environment variable is required");
  }
  if (secret.length < 32) {
    throw new Error("EMAIL_HMAC_SECRET must be at least 32 characters");
  }
  cachedHmacSecret = Buffer.from(
    crypto.hkdfSync("sha256", secret, "", "unsubscribe-token", 32)
  );
  return cachedHmacSecret;
}

/** Tokens expire after 30 days */
const TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^[0-9a-f]+$/i;

function createUnsubscribeToken(userId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${userId}.${timestamp}`;
  const hmac = crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("hex");
  return `${userId}.${timestamp}.${hmac}`;
}

function verifyUnsubscribeToken(token: string): string | null {
  const firstDot = token.indexOf(".");
  if (firstDot === -1) {
    return null;
  }

  const lastDot = token.lastIndexOf(".");
  if (lastDot === firstDot) {
    return null;
  }

  const userId = token.slice(0, firstDot);
  const timestampStr = token.slice(firstDot + 1, lastDot);
  const providedHmac = token.slice(lastDot + 1);

  if (!(userId && timestampStr && providedHmac)) {
    return null;
  }

  if (!UUID_RE.test(userId)) {
    return null;
  }

  if (!HEX_RE.test(providedHmac) || providedHmac.length !== 64) {
    return null;
  }

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > TOKEN_MAX_AGE_SECONDS) {
    return null;
  }

  const payload = `${userId}.${timestampStr}`;
  const expectedHmac = crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("hex");

  const providedBuffer = Buffer.from(providedHmac, "hex");
  const expectedBuffer = Buffer.from(expectedHmac, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  return userId;
}

function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://themagiclab.app";
  const isDev = process.env.NODE_ENV === "development";
  if (!(isDev || appUrl.startsWith("https://"))) {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS");
  }
  return appUrl;
}

interface SendEmailOptions {
  html: string;
  subject: string;
  to: string;
  userId?: string;
}

interface SendEmailResult {
  id: string;
}

async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resend = getResendClient();

  // In non-production environments (local dev + Vercel preview deploys),
  // redirect all emails to Resend's test address so they appear in the
  // dashboard but never reach real inboxes.
  const isProduction = process.env.VERCEL_ENV === "production";
  const to = isProduction ? options.to : "delivered@resend.dev";

  const headers: Record<string, string> = {};
  if (options.userId) {
    const token = createUnsubscribeToken(options.userId);
    const appUrl = getAppUrl();
    const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const { data, error } = await resend.emails.send({
    from: "The Magic Lab <noreply@themagiclab.app>",
    to,
    subject: options.subject,
    html: options.html,
    headers,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to send email: no response data");
  }

  return { id: data.id };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

interface SendWelcomeEmailOptions {
  name?: string;
  to: string;
  userId: string;
}

async function sendWelcomeEmail(
  options: SendWelcomeEmailOptions
): Promise<SendEmailResult> {
  const html = await render(
    createElement(WelcomeEmail, {
      name: options.name,
      appUrl: getAppUrl(),
    })
  );

  return sendEmail({
    to: options.to,
    userId: options.userId,
    subject: "Welcome to The Magic Lab",
    html,
  });
}

export type { SendEmailOptions, SendEmailResult, SendWelcomeEmailOptions };
export {
  createUnsubscribeToken,
  escapeHtml,
  sendEmail,
  sendWelcomeEmail,
  verifyUnsubscribeToken,
};
