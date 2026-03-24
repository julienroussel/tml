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
    if (session?.user?.id && (await isUserBanned(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return handler.GET(request, context);
}

// POST does not need a ban check: the token endpoint is GET-only (Neon Auth
// API_ENDPOINTS.token.method === "GET"). POST paths (sign-in, refresh-token,
// sign-out, etc.) don't issue PowerSync sync tokens. Banned users are blocked
// at token retrieval (GET /token above) and by the proxy redirect in proxy.ts.
export const { POST } = handler;
