import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_P, buildCookie } from "@/lib/session-cookie";

/**
 * Demo-session resilience for hosted previews (Next 16 "proxy" convention).
 *
 * Some embedded preview contexts refuse third-party cookies entirely, and the App Router's
 * client-side navigation uses render-time hrefs, so query-string tokens alone would not
 * survive soft navigation. Therefore, when a request carries the signed `ecs` demo token:
 *   1. it is copied into a request header so `getSessionUser` can use it as a fallback, and
 *   2. if the request did not already send a session cookie, we try to (re)establish the
 *      cookie session here – including a non-httpOnly "canary" cookie the client can read to
 *      know whether cookies are being stored (see SessionBridge).
 */
export function proxy(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("ecs");
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE) || request.cookies.has(SESSION_COOKIE_P);

  if (!token) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set("x-ecs-token", token);
  const response = NextResponse.next({ request: { headers } });

  if (!hasSessionCookie) {
    const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
    const maxAge = 60 * 60 * 8;
    response.headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, token, { https: false, maxAge }));
    if (https) response.headers.append("Set-Cookie", buildCookie(SESSION_COOKIE_P, token, { https: true, maxAge }));
    // Readable canary: lets client code detect whether this browser stores cookies here.
    response.headers.append("Set-Cookie", `ec_cs=1; Path=/; Max-Age=${maxAge}${https ? "; Secure; SameSite=None; Partitioned" : "; SameSite=Lax"}`);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|map|txt|webmanifest)$).*)"],
};
