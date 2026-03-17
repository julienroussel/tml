import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
if (!baseUrl) {
  throw new Error("NEON_AUTH_BASE_URL environment variable is required");
}

const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!cookieSecret) {
  throw new Error("NEON_AUTH_COOKIE_SECRET environment variable is required");
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
  },
});
