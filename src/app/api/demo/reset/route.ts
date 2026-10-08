import { resetDemoData } from "@/lib/seed";
import { forgetIpSession } from "@/lib/session-ip";
import { sessionCookieDeletions } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/** Restores the original sample data (removes accounts created in the demo) and signs everyone out. */
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  await resetDemoData();
  forgetIpSession(req.headers);
  const headers = new Headers({ Location: "/sign-in?reset=1", "Cache-Control": "no-store" });
  for (const c of sessionCookieDeletions()) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}
