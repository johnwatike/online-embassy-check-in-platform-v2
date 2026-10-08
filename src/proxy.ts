import { NextResponse, type NextRequest } from "next/server";

/**
 * Demo-session resilience for hosted previews (Next 16 "proxy" convention).
 *
 * Some embedded preview contexts refuse third-party cookies entirely. Demo sign-in therefore
 * also passes the signed session as an `ecs` query parameter; this proxy copies it into a
 * request header so `getSessionUser` (server runtime) can validate and use it as a fallback.
 * The value is a signed demo token – see src/lib/auth.ts.
 */
export function proxy(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("ecs");
  if (!token) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set("x-ecs-token", token);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|map|txt|webmanifest)$).*)"],
};
