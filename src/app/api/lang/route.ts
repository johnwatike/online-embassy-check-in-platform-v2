import { LANG_COOKIE_NAME, buildCookie, isHttps, safeBackPath } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/** Sets the interface language (English or Kiswahili) and returns to the page the user was on. */
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  let lang = "en";
  try {
    lang = (await req.formData()).get("lang") === "sw" ? "sw" : "en";
  } catch {
    lang = "en";
  }
  const headers = new Headers({ Location: safeBackPath(req.headers.get("referer")), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", buildCookie(LANG_COOKIE_NAME, lang, { https: isHttps(req.headers), maxAge: 60 * 60 * 24 * 365, httpOnly: false }));
  return new Response(null, { status: 303, headers });
}
