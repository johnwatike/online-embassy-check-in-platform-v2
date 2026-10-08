import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signSession } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { audit } from "@/lib/services";
import { isHttps, sessionCookieDeletions, sessionCookieHeaders } from "@/lib/session-cookie";
import { UUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * DEMO sign-in: choose a fictional persona. No password is requested or stored.
 *
 * This is a plain HTML form post to a stable URL (not a Server Action). Server Action ids change on every
 * deployment, so a page left open across an update would fail with "Something went wrong". A stable URL keeps
 * working, and it also works without JavaScript.
 */
export async function POST(req: Request) {
  // Refuse form posts that come from another site (basic CSRF protection).
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  await ensureSeeded();

  let userId = "";
  try {
    userId = String((await req.formData()).get("userId") ?? "");
  } catch {
    userId = "";
  }
  const [u] = UUID.test(userId) ? await db.select().from(users).where(eq(users.id, userId)).limit(1) : [];
  if (!u) return new Response(null, { status: 303, headers: { Location: "/sign-in?error=unknown", "Cache-Control": "no-store" } });

  const https = isHttps(req.headers);
  const token = signSession(u.id);
  // The signed session travels as a cookie AND (as a fallback for embedded previews that refuse
  // all cookies) as an `ecs` query parameter that middleware forwards to getSessionUser.
  const headers = new Headers({ Location: `${u.role === "citizen" ? "/app" : "/staff"}?ecs=${encodeURIComponent(token)}`, "Cache-Control": "no-store" });
  for (const c of sessionCookieDeletions()) headers.append("Set-Cookie", c);
  for (const c of sessionCookieHeaders(token, https, 60 * 60 * 8)) headers.append("Set-Cookie", c);
  await audit(u, "session.start", "session", null, `Demo session started (${u.role})`);
  return new Response(null, { status: 303, headers });
}
