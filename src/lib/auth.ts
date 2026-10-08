import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { citizenProfiles, missions, users } from "@/db/schema";
import { cookieOptions } from "./cookies";
import { SESSION_COOKIE, cookieValues } from "./session-cookie";
import type { Mission, User } from "./types";

/**
 * DEMO SESSIONS ONLY.
 * No passwords are requested or stored. A demo session is a signed, httpOnly cookie that
 * contains a user id. Production deployments must replace this with real authentication
 * (OIDC/SAML SSO with MFA for staff, passkeys or verified email for citizens).
 */
const SECRET = process.env.SESSION_SECRET ?? "embassy-connect-demo-only-secret";

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Signed cookie value for a user id (used by the sign-in route handler). */
export const signSession = (userId: string) => `${userId}.${sign(userId)}`;

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), await cookieOptions(60 * 60 * 8));
}

export async function endSession() {
  const jar = await cookies();
  // Expire with the same attributes it was set with, so partitioned cookies are cleared too.
  jar.set(SESSION_COOKIE, "", await cookieOptions(0));
}

function validSignedId(raw: string): string | null {
  const [userId, sig] = raw.split(".");
  if (!userId || !sig || !/^[0-9a-f-]{36}$/.test(userId)) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(userId));
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

/**
 * Looks at every session cookie the browser sent (a stale duplicate must not hide a valid one)
 * and returns the first one that is correctly signed and belongs to an existing user.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const h = await headers();
  for (const raw of cookieValues(h.get("cookie") ?? "", SESSION_COOKIE)) {
    const userId = validSignedId(raw);
    if (!userId) continue;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user) return user;
  }
  return null;
});

export const getProfile = cache(async (userId: string) => {
  const [p] = await db.select().from(citizenProfiles).where(eq(citizenProfiles.userId, userId)).limit(1);
  return p ?? null;
});

/** Server-side guard for citizen pages and actions. Staff accounts are sent to the staff portal. */
export async function requireCitizen() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "citizen") redirect("/staff");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/sign-in");
  return { user, profile };
}

export const getMissionById = cache(async (id: string): Promise<Mission | null> => {
  const [m] = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  return m ?? null;
});

/** Server-side guard for staff pages and actions. */
export async function requireStaff() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role === "citizen") redirect("/app");
  const mission = user.missionId ? await getMissionById(user.missionId) : null;
  return { user, mission };
}
