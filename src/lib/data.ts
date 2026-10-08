import { and, asc, desc, eq, gte, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  alertReads,
  alerts,
  appointments,
  assistanceCases,
  caseAttachments,
  caseEvents,
  caseMessages,
  citizenProfiles,
  crisisEvents,
  crisisResponses,
  dependants,
  emergencyContacts,
  missionJurisdictions,
  missions,
  notificationPreferences,
  notifications,
  tripDestinations,
  tripEvents,
  trips,
  users,
  wellbeingUpdates,
} from "@/db/schema";
import { todayStr } from "./format";
import { regionMatches } from "./routing";
import type { DestWithMission, TripFull } from "./types";

export async function loadTrips(cond: SQL | undefined): Promise<TripFull[]> {
  const rows = await db.select().from(trips).where(cond).orderBy(desc(trips.startsOn));
  if (!rows.length) return [];
  const dests = await db
    .select({ d: tripDestinations, m: missions })
    .from(tripDestinations)
    .leftJoin(missions, eq(missions.id, tripDestinations.missionId))
    .where(inArray(tripDestinations.tripId, rows.map((r) => r.id)))
    .orderBy(asc(tripDestinations.position));
  const by = new Map<string, DestWithMission[]>();
  for (const { d, m } of dests) {
    const list = by.get(d.tripId) ?? [];
    list.push({ ...d, mission: m });
    by.set(d.tripId, list);
  }
  return rows.map((r) => ({ ...r, destinations: by.get(r.id) ?? [] }));
}

export const getUserTrips = (userId: string) => loadTrips(eq(trips.userId, userId));

export async function getUserTrip(userId: string, tripId: string) {
  if (!/^[0-9a-f-]{36}$/.test(tripId)) return null;
  const [t] = await loadTrips(and(eq(trips.userId, userId), eq(trips.id, tripId)));
  return t ?? null;
}

export function currentDestination(trip: TripFull): DestWithMission | undefined {
  const t = todayStr();
  return (
    trip.destinations.find((d) => d.arrivalDate <= t && (!d.departureDate || d.departureDate >= t)) ??
    trip.destinations.find((d) => !d.departureDate || d.departureDate >= t) ??
    trip.destinations[trip.destinations.length - 1]
  );
}

export function pickCurrentTrip(list: TripFull[]): TripFull | null {
  const active = list.filter((t) => t.status === "active").sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  if (active.length) return active[0];
  const planned = list.filter((t) => t.status === "planned").sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return planned[0] ?? null;
}

export async function relevantAlerts(userId: string, includeExpired = false) {
  const list = await loadTrips(and(eq(trips.userId, userId), inArray(trips.status, ["planned", "active"])));
  const dests = list.flatMap((tr) => tr.destinations.map((d) => ({ d, status: tr.status })));
  if (!dests.length) return [];
  const countries = [...new Set(dests.map((x) => x.d.country))];
  const rows = await db
    .select({ a: alerts, mission: missions.name, tz: missions.timezone, readAt: alertReads.readAt })
    .from(alerts)
    .innerJoin(missions, eq(missions.id, alerts.missionId))
    .leftJoin(alertReads, and(eq(alertReads.alertId, alerts.id), eq(alertReads.userId, userId)))
    .where(and(inArray(alerts.status, includeExpired ? ["published", "expired"] : ["published"]), inArray(alerts.country, countries)))
    .orderBy(desc(alerts.publishedAt));
  const now = new Date();
  return rows
    .map((r) => ({ ...r.a, missionName: r.mission, missionTz: r.tz, readAt: r.readAt, expired: r.a.status === "expired" || (r.a.expiresAt !== null && r.a.expiresAt < now) }))
    .filter((a) => (includeExpired || !a.expired) && dests.some((x) => x.d.country === a.country && regionMatches(a.region, x.d.region) && (a.audience === "all" || a.audience === x.status)));
}

export const getNotifications = (userId: string) =>
  db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(60);

export async function unreadCount(userId: string) {
  const [a, n] = await Promise.all([relevantAlerts(userId), db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))]);
  return a.filter((x) => !x.readAt).length + n.length;
}

export const getUserCases = (userId: string) =>
  db
    .select({ c: assistanceCases, mission: missions.name })
    .from(assistanceCases)
    .innerJoin(missions, eq(missions.id, assistanceCases.missionId))
    .where(eq(assistanceCases.userId, userId))
    .orderBy(desc(assistanceCases.createdAt));

export async function getUserCase(userId: string, caseId: string) {
  if (!/^[0-9a-f-]{36}$/.test(caseId)) return null;
  const [row] = await db
    .select({ c: assistanceCases, mission: missions, assignee: users.displayName })
    .from(assistanceCases)
    .innerJoin(missions, eq(missions.id, assistanceCases.missionId))
    .leftJoin(users, eq(users.id, assistanceCases.assignedToId))
    .where(and(eq(assistanceCases.id, caseId), eq(assistanceCases.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [messages, events, attachments] = await Promise.all([
    db.select().from(caseMessages).where(eq(caseMessages.caseId, caseId)).orderBy(asc(caseMessages.createdAt)),
    db.select().from(caseEvents).where(and(eq(caseEvents.caseId, caseId), eq(caseEvents.citizenVisible, true))).orderBy(desc(caseEvents.createdAt)),
    db.select({ id: caseAttachments.id, filename: caseAttachments.filename, sizeBytes: caseAttachments.sizeBytes }).from(caseAttachments).where(eq(caseAttachments.caseId, caseId)),
  ]);
  return { ...row, messages, events, attachments };
}

export const getUserAppointments = (userId: string) =>
  db
    .select({ a: appointments, mission: missions })
    .from(appointments)
    .innerJoin(missions, eq(missions.id, appointments.missionId))
    .where(eq(appointments.userId, userId))
    .orderBy(asc(appointments.startsAt));

export async function pendingCrisis(userId: string) {
  return db
    .select({ r: crisisResponses, e: crisisEvents, mission: missions.name })
    .from(crisisResponses)
    .innerJoin(crisisEvents, eq(crisisEvents.id, crisisResponses.crisisEventId))
    .innerJoin(missions, eq(missions.id, crisisEvents.missionId))
    .where(and(eq(crisisResponses.userId, userId), isNull(crisisResponses.response), eq(crisisEvents.status, "active")));
}

export async function getTimeline(userId: string, limit = 10) {
  const [te, wu, cs, ap] = await Promise.all([
    db.select().from(tripEvents).where(eq(tripEvents.userId, userId)).orderBy(desc(tripEvents.createdAt)).limit(limit),
    db.select().from(wellbeingUpdates).where(eq(wellbeingUpdates.userId, userId)).orderBy(desc(wellbeingUpdates.createdAt)).limit(limit),
    db.select().from(assistanceCases).where(eq(assistanceCases.userId, userId)).orderBy(desc(assistanceCases.createdAt)).limit(limit),
    db.select().from(appointments).where(and(eq(appointments.userId, userId), gte(appointments.bookedAt, new Date(0)))).orderBy(desc(appointments.bookedAt)).limit(limit),
  ]);
  const items: { at: Date; title: string; detail?: string; href?: string; kind: string }[] = [
    ...te.map((e) => ({ at: e.createdAt, title: e.summary, kind: "trip", href: `/app/trips/${e.tripId}` })),
    ...wu.map((w) => ({ at: w.createdAt, title: `Wellbeing update recorded`, detail: w.note ?? undefined, kind: `wellbeing:${w.status}`, href: "/app/status" })),
    ...cs.map((c) => ({ at: c.createdAt, title: `Assistance request ${c.reference} submitted`, kind: "case", href: `/app/cases/${c.id}` })),
    ...ap.filter((a) => a.bookedAt).map((a) => ({ at: a.bookedAt!, title: `Appointment ${a.reference ?? ""} booked: ${a.serviceName}`, kind: "appointment", href: "/app/appointments" })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

export async function getPrefs(userId: string) {
  const [p] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  return p ?? null;
}

export const getContacts = (userId: string) => db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId)).orderBy(asc(emergencyContacts.createdAt));

export const getTripDependants = (tripId: string) => db.select().from(dependants).where(eq(dependants.tripId, tripId));

export const getWellbeingHistory = (userId: string, limit = 20) =>
  db
    .select({ w: wellbeingUpdates, ref: trips.reference })
    .from(wellbeingUpdates)
    .leftJoin(trips, eq(trips.id, wellbeingUpdates.tripId))
    .where(eq(wellbeingUpdates.userId, userId))
    .orderBy(desc(wellbeingUpdates.createdAt))
    .limit(limit);

// ----- Public mission directory -----
export async function listMissionsWithJurisdictions() {
  const [ms, js] = await Promise.all([db.select().from(missions).orderBy(asc(missions.country), asc(missions.city)), db.select().from(missionJurisdictions)]);
  return ms.map((m) => ({ ...m, jurisdictions: js.filter((j) => j.missionId === m.id) }));
}

export async function getMissionDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [m] = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  if (!m) return null;
  const js = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, id)).orderBy(asc(missionJurisdictions.country), asc(missionJurisdictions.region));
  return { ...m, jurisdictions: js };
}

export async function activeAlertsForMission(missionId: string) {
  const now = new Date();
  return db
    .select()
    .from(alerts)
    .where(and(eq(alerts.missionId, missionId), eq(alerts.status, "published"), or(isNull(alerts.expiresAt), gte(alerts.expiresAt, now))))
    .orderBy(desc(alerts.publishedAt))
    .limit(5);
}

export const getUserById = async (id: string) => {
  const [u] = await db.select({ u: users, p: citizenProfiles }).from(users).leftJoin(citizenProfiles, eq(citizenProfiles.userId, users.id)).where(eq(users.id, id)).limit(1);
  return u ?? null;
};
