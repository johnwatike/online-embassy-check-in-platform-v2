import { and, eq, like, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  missionJurisdictions,
  missions,
  notifications,
  tripDestinations,
  trips,
  type Severity,
  type TripStatus,
} from "@/db/schema";
import type { RoutingEntry, User } from "./types";

type Actor = Pick<User, "id" | "displayName" | "role" | "missionId">;

/** Append an audit event. Summaries must never contain sensitive content (notes, locations, descriptions). */
export async function audit(
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  missionId?: string | null,
  x: typeof db = db,
) {
  await x.insert(auditEvents).values({
    actorId: actor?.id ?? null,
    actorName: actor?.displayName ?? "System",
    actorRole: actor?.role ?? "system",
    missionId: missionId ?? actor?.missionId ?? null,
    action,
    entityType,
    entityId,
    summary,
  });
}

/** Create an in-app notification. Email/SMS/push delivery is SIMULATED in this demo. */
export async function notify(
  userId: string,
  n: { kind: "case" | "appointment" | "crisis" | "trip" | "system"; title: string; body: string; href?: string; severity?: Severity },
  x: typeof db = db,
) {
  await x.insert(notifications).values({
    userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href ?? null,
    severity: n.severity ?? "info",
  });
}

export async function loadRouting(x: typeof db = db): Promise<RoutingEntry[]> {
  const rows = await x
    .select({
      country: missionJurisdictions.country,
      region: missionJurisdictions.region,
      missionId: missions.id,
      missionName: missions.name,
      missionCity: missions.city,
      missionCountry: missions.country,
    })
    .from(missionJurisdictions)
    .innerJoin(missions, eq(missions.id, missionJurisdictions.missionId));
  return rows;
}

/** Find the distinct citizens a mission could reach with an alert / wellbeing check. */
export async function findRecipients(
  opts: { missionId: string | null; country: string; region?: string | null; audience: "all" | "active" | "planned" },
  x: typeof db = db,
) {
  const statuses: TripStatus[] = opts.audience === "all" ? ["planned", "active"] : [opts.audience];
  const conds = [eq(tripDestinations.country, opts.country), inArray(trips.status, statuses)];
  if (opts.missionId) conds.push(eq(tripDestinations.missionId, opts.missionId));
  if (opts.region && opts.region.trim()) conds.push(like(tripDestinations.region, `%${opts.region.trim()}%`));
  const rows = await x
    .select({ userId: trips.userId, tripId: trips.id })
    .from(tripDestinations)
    .innerJoin(trips, eq(trips.id, tripDestinations.tripId))
    .where(and(...conds));
  const seen = new Map<string, string>();
  for (const r of rows) if (!seen.has(r.userId)) seen.set(r.userId, r.tripId);
  return [...seen.entries()].map(([userId, tripId]) => ({ userId, tripId }));
}
