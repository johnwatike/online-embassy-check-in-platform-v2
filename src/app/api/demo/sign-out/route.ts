import { SESSION_COOKIE, buildCookie, isHttps, legacyCookieDeletions } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/** Ends the demo session by expiring every variant of the session cookie. Plain form post, works without JavaScript. */
export async function POST(req: Request) {
  const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
  for (const c of legacyCookieDeletions(SESSION_COOKIE)) headers.append("Set-Cookie", c);
  headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, "", { https: isHttps(req.headers), maxAge: 0 }));
  return new Response(null, { status: 303, headers });
}
