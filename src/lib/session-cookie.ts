/**
 * Cookie helpers that work on plain localhost and behind an HTTPS preview proxy (including inside an iframe).
 * Kept free of Next.js imports so route handlers, server actions and pages can all share it.
 */
export const SESSION_COOKIE = "ec_demo_session";
export const LANG_COOKIE_NAME = "ec_lang";

/** True when the browser reached us over HTTPS (directly, or through a proxy that says so). */
export function isHttps(h: Headers): boolean {
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  if (proto === "https") return true;
  return (h.get("origin") ?? "").startsWith("https://") || (h.get("referer") ?? "").startsWith("https://");
}

/**
 * Builds Set-Cookie header strings.
 * Over HTTPS we use SameSite=None; Secure; Partitioned so the cookie also works when the app is shown in a frame.
 * Production deployments should serve the app first-party on its own domain and use SameSite=Lax or Strict.
 */
export function buildCookie(name: string, value: string, o: { https: boolean; maxAge: number; httpOnly?: boolean }): string {
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${o.maxAge}`];
  if (o.httpOnly !== false) parts.push("HttpOnly");
  if (o.https) parts.push("Secure", "SameSite=None", "Partitioned");
  else parts.push("SameSite=Lax");
  return parts.join("; ");
}

/**
 * Older builds set the session cookie without the Partitioned attribute. A browser can hold both variants and send
 * the stale one first, which looks like "sign-in did nothing". These headers expire the legacy variants.
 */
export function legacyCookieDeletions(name: string): string[] {
  return [`${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`, `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`];
}

/** Every value for a cookie name in a raw Cookie header (a browser may send duplicates). */
export function cookieValues(header: string, name: string): string[] {
  const out: string[] = [];
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) out.push(part.slice(i + 1).trim());
  }
  return out;
}

/** Only ever redirect back to a path on this site. */
export function safeBackPath(referer: string | null, fallback = "/"): string {
  if (!referer) return fallback;
  try {
    const u = new URL(referer);
    const p = u.pathname + u.search;
    return p.startsWith("/") && !p.startsWith("//") ? p : fallback;
  } catch {
    return fallback;
  }
}
