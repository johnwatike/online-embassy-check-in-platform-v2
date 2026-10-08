import { resetDemoData } from "@/lib/seed";
import { SESSION_COOKIE, buildCookie, isHttps, legacyCookieDeletions } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/** Restores the original sample data (removes accounts created in the demo) and signs everyone out. */
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  await resetDemoData();
  const headers = new Headers({ Location: "/sign-in?reset=1", "Cache-Control": "no-store" });
  for (const c of legacyCookieDeletions(SESSION_COOKIE)) headers.append("Set-Cookie", c);
  headers.append("Set-Cookie", buildCookie(SESSION_COOKIE, "", { https: isHttps(req.headers), maxAge: 0 }));
  return new Response(null, { status: 303, headers });
}
