/**
 * DEMO-ONLY last-resort session fallback for hosted previews.
 *
 * Embedded preview frames can refuse every cookie variant, and cached client bundles may
 * soft-navigate without the `ecs` URL token. In this sandbox the only visitor is the demo
 * user, so once a request authenticates via cookie or token we remember the client's IP for
 * the session TTL; later requests from the same IP (flight requests, server-action posts)
 * then resolve to the same demo user.
 *
 * NEVER use this in production – real deployments must authenticate every request
 * (SSO/MFA for staff, verified sessions for citizens).
 */
type Entry = { userId: string; exp: number };

const TTL = 8 * 3600e3;

const g = globalThis as typeof globalThis & { __ecIpSessions?: Map<string, Entry> };
const map = (g.__ecIpSessions ??= new Map());

/** Stable key for the visiting browser: first hop of X-Forwarded-For (preview proxy adds it). */
export function clientKey(h: Headers): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "local";
}

export function rememberIpSession(h: Headers, userId: string) {
  map.set(clientKey(h), { userId, exp: Date.now() + TTL });
}

export function lookupIpSession(h: Headers): string | null {
  const e = map.get(clientKey(h));
  if (!e) return null;
  if (e.exp < Date.now()) {
    map.delete(clientKey(h));
    return null;
  }
  return e.userId;
}

export function forgetIpSession(h: Headers) {
  map.delete(clientKey(h));
}
