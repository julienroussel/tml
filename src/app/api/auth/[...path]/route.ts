import { type NextRequest, NextResponse } from "next/server";
import { isUserBanned } from "@/auth/ban-check";
import { auth } from "@/auth/server";

const handler = auth.handler();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;

  if (path[0] === "token") {
    const { data: session } = await auth.getSession();
    // DIAG #300 — REVERT BEFORE MERGE. Log token-endpoint context so we can
    // see on Vercel preview logs whether the session is reaching the handler.
    console.info("[DIAG #300] /api/auth/token GET", {
      hasSession: session !== null,
      userId: session?.user?.id ?? null,
      host: request.headers.get("host"),
      origin: request.headers.get("origin"),
      cookieHeaderLen: request.headers.get("cookie")?.length ?? 0,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    });
    if (session?.user?.id && (await isUserBanned(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const response = await handler.GET(request, context);
  if (path[0] === "token") {
    // DIAG #300 — log the response status the upstream Neon Auth handler gave us.
    console.info("[DIAG #300] /api/auth/token response status", {
      status: response.status,
      ok: response.ok,
    });
  }
  return response;
}

// POST does not need a ban check: the token endpoint is GET-only (Neon Auth
// API_ENDPOINTS.token.method === "GET"). POST paths (sign-in, refresh-token,
// sign-out, etc.) don't issue PowerSync sync tokens. Banned users are blocked
// at token retrieval (GET /token above) and by the proxy redirect in proxy.ts.
export const { POST } = handler;
