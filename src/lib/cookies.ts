import { headers } from "next/headers";

/**
 * Cookie attributes that work both on plain localhost and behind an HTTPS preview proxy.
 *
 * When the page is served over HTTPS (possibly inside a frame on another site, as in a hosted preview),
 * a SameSite=Lax cookie is dropped and sign-in appears to do nothing. In that case we use
 * SameSite=None; Secure; Partitioned, which browsers accept for embedded pages. Cross-site form posts
 * are still blocked by Next.js's Server Action Origin check (see allowedOrigins in next.config.ts).
 *
 * Production deployments should serve the app first-party on its own domain and use SameSite=Lax or Strict.
 */
export async function cookieOptions(maxAge: number, httpOnly = true) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const https = proto === "https" || (h.get("origin") ?? "").startsWith("https://");
  if (https) {
    return { httpOnly, secure: true, sameSite: "none" as const, partitioned: true, path: "/", maxAge };
  }
  return { httpOnly, sameSite: "lax" as const, path: "/", maxAge };
}
