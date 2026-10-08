import { sessionCookieDeletions } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/** Ends the demo session by expiring every variant of the session cookie. Plain form post, works without JavaScript. */
export async function POST() {
  const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
  for (const c of sessionCookieDeletions()) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}
