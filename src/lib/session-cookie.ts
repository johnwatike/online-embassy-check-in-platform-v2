/**
 * Cookie helpers that work on plain localhost, behind an HTTPS preview proxy, and inside an
 * embedded frame (hosted live preview). Kept free of Next.js imports so route handlers,
 * server actions and pages can all share it.
 *
 * Two session cookies are set under different names:
 *  - `ec_demo_session`   SameSite=Lax            → first-party tabs and plain localhost
 *  - `ec_demo_session_p` SameSite=None;Secure;Partitioned → third-party/embedded HTTPS frames
 * Browsers that reject one variant still accept the other; the session reader accepts both.
 */
export const SESSION_COOKIE = "ec_demo_session";
export const SESSION_COOKIE_P = "ec_demo_session_p";
export const SESSION_COOKIE_NAMES = [SESSION_COOKIE, SESSION_COOKIE_P];
export const LANG_COOKIE_NAME = "ec_lang";

/** True when the browser reached us over HTTPS (directly, or through a proxy that says so). */
export function isHttps(h: Headers): boolean {
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  if (proto === "https") return true;
  return (h.get("origin") ?? "").startsWith("https://") || (h.get("referer") ?? "").startsWith("https://");
}

/**
 * Builds Set-Cookie header strings.
 * The partitioned variant uses SameSite=None; Secure; Partitioned so browsers also accept it
 * when the app runs in a frame on another site. Production deployments should serve the app
 * first-party on its own domain and use SameSite=Lax or Strict.
 */
export function buildCookie(name: string, value: string, o: { https: boolean; maxAge: number; httpOnly?: boolean }): string {
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${o.maxAge}`];
  if (o.httpOnly !== false) parts.push("HttpOnly");
  if (o.https) parts.push("Secure", "SameSite=None", "Partitioned");
  else parts.push("SameSite=Lax");
  return parts.join("; ");
}

/** Set-Cookie headers that establish (or clear) the session in every browser context. */
export function sessionCookieHeaders(value: string, https: boolean, maxAge: number): string[] {
  const out = [buildCookie(SESSION_COOKIE, value, { https: false, maxAge })];
  if (https) out.push(buildCookie(SESSION_COOKIE_P, value, { https: true, maxAge }));
  return out;
}

/**
 * Set-Cookie headers that expire every session variant, including cookies written by older
 * builds (a stale duplicate must never hide a fresh value).
 */
export function sessionCookieDeletions(): string[] {
  return [
    ...legacyCookieDeletions(SESSION_COOKIE),
    `${SESSION_COOKIE_P}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`,
    `${SESSION_COOKIE_P}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  ];
}

/** Older builds set the session cookie without the Partitioned attribute. These expire those variants. */
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
