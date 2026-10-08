import { and, asc, desc, eq, gte, like, inArray, isNull, lte, ne, or, sql, count, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  assistanceCases,
  citizenProfiles,
  crisisEvents,
  crisisResponses,
  feedback,
  tripDestinations,
  trips,
  users,
  type TripStatus,
} from "@/db/schema";
import { addDays, todayStr } from "./format";
import { geocodePlace } from "./geo";
import type { User } from "./types";

/** Mission scoping: officers and mission admins only ever see their own mission. Platform admins see aggregates only. */
export const missionScope = (user: User, col: Parameters<typeof eq>[0]): SQL | undefined => (user.missionId ? eq(col, user.missionId) : undefined);

export type RegFilters = {
  q?: string;
  country?: string;
  region?: string;
  status?: string;
  wellbeing?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

const PAGE = 12;

export async function staffRegistrations(user: User, f: RegFilters) {
  const conds: (SQL | undefined)[] = [eq(tripDestinations.missionId, user.missionId ?? "00000000-0000-0000-0000-000000000000")];
  if (f.q) conds.push(or(like(citizenProfiles.fullName, `%${f.q}%`), like(trips.reference, `%${f.q}%`)));
  if (f.country) conds.push(eq(tripDestinations.country, f.country));
  if (f.region) conds.push(like(tripDestinations.region, `%${f.region}%`));
  if (f.status && ["planned", "active", "closed", "cancelled"].includes(f.status)) conds.push(eq(trips.status, f.status as TripStatus));
  if (f.wellbeing === "none") conds.push(isNull(trips.wellbeingStatus));
  else if (f.wellbeing) conds.push(eq(trips.wellbeingStatus, f.wellbeing as "safe"));
  // travel period overlap
  if (f.from) conds.push(or(isNull(tripDestinations.departureDate), gte(tripDestinations.departureDate, f.from)));
  if (f.to) conds.push(lte(tripDestinations.arrivalDate, f.to));
  const where = and(...conds);

  const sortCols = {
    name: citizenProfiles.fullName,
    ref: trips.reference,
    destination: tripDestinations.country,
    arrival: tripDestinations.arrivalDate,
    departure: tripDestinations.departureDate,
    status: trips.status,
    wellbeing: trips.wellbeingUpdatedAt,
  } as const;
  const col = sortCols[(f.sort as keyof typeof sortCols) ?? "arrival"] ?? tripDestinations.arrivalDate;
  const order = f.dir === "asc" ? asc(col) : desc(col);
  const page = Math.max(1, f.page ?? 1);

  const base = () =>
    db
      .select({ c: count() })
      .from(tripDestinations)
      .innerJoin(trips, eq(trips.id, tripDestinations.tripId))
      .innerJoin(citizenProfiles, eq(citizenProfiles.userId, trips.userId))
      .where(where);
  const [[{ c: total }], rows] = await Promise.all([
    base(),
    db
      .select({
        tripId: trips.id,
        reference: trips.reference,
        name: citizenProfiles.fullName,
        country: tripDestinations.country,
        region: tripDestinations.region,
        arrival: tripDestinations.arrivalDate,
        departure: tripDestinations.departureDate,
        status: trips.status,
        purpose: trips.purpose,
        wellbeing: trips.wellbeingStatus,
        wellbeingAt: trips.wellbeingUpdatedAt,
      })
      .from(tripDestinations)
      .innerJoin(trips, eq(trips.id, tripDestinations.tripId))
      .innerJoin(citizenProfiles, eq(citizenProfiles.userId, trips.userId))
      .where(where)
      .orderBy(order)
      .limit(PAGE)
      .offset((page - 1) * PAGE),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), pageSize: PAGE };
}

/** One plotted point per registered destination on the staff check-in map. */
export type MapPoint = {
  id: string;
  citizen: string;
  ref: string;
  status: "planned" | "active";
  wellbeing: string | null;
  country: string;
  region: string | null;
  place: string;
  lat: number;
  lng: number;
  approx: boolean;
  lodging: string | null;
  arrival: string;
  departure: string | null;
};

/**
 * Check-in map data for the staff portal: every current/upcoming destination in this
 * mission's jurisdiction, positioned at the citizen's lodging coordinates when they shared
 * them, otherwise at the best-matching place (or capital, marked approximate) for the
 * destination. Individual records – only for roles with records.view.
 */
export async function staffMapPoints(user: User): Promise<MapPoint[]> {
  if (!user.missionId) return [];
  const rows = await db
    .select({
      tripId: trips.id,
      ref: trips.reference,
      status: trips.status,
      wellbeing: trips.wellbeingStatus,
      citizen: citizenProfiles.fullName,
      country: tripDestinations.country,
      region: tripDestinations.region,
      arrival: tripDestinations.arrivalDate,
      departure: tripDestinations.departureDate,
      lodgingName: trips.lodgingName,
      lodgingAddress: trips.accommodation,
      lodgingPlace: trips.lodgingPlace,
      lodgingLat: trips.lodgingLat,
      lodgingLng: trips.lodgingLng,
    })
    .from(trips)
    .innerJoin(tripDestinations, eq(tripDestinations.tripId, trips.id))
    .innerJoin(citizenProfiles, eq(citizenProfiles.userId, trips.userId))
    .where(and(eq(tripDestinations.missionId, user.missionId), inArray(trips.status, ["active", "planned"])))
    .orderBy(asc(citizenProfiles.fullName));

  const points: MapPoint[] = [];
  for (const r of rows) {
    let lat = r.lodgingLat;
    let lng = r.lodgingLng;
    let place = r.lodgingPlace ?? "";
    let approx = false;
    if (lat == null || lng == null) {
      const geo = geocodePlace(`${r.region ?? ""} ${r.country}`, r.country);
      if (!geo) continue;
      lat = geo.lat;
      lng = geo.lng;
      place = geo.place;
      approx = geo.kind === "capital" || !r.region;
    }
    points.push({
      id: `${r.tripId}`,
      citizen: r.citizen,
      ref: r.ref,
      status: r.status as "planned" | "active",
      wellbeing: r.wellbeing,
      country: r.country,
      region: r.region,
      place,
      lat,
      lng,
      approx,
      lodging: [r.lodgingName, r.lodgingAddress].filter(Boolean).join(" · ") || null,
      arrival: r.arrival,
      departure: r.departure,
    });
  }
  return points;
}

export async function dashboardStats(user: User) {
  const t = todayStr();
  const week = addDays(7);
  const scopeD = missionScope(user, tripDestinations.missionId);
  const regs = await db
    .select({
      tripId: trips.id,
      status: trips.status,
      purpose: trips.purpose,
      country: tripDestinations.country,
      createdAt: trips.createdAt,
      arrival: tripDestinations.arrivalDate,
      departure: tripDestinations.departureDate,
      wellbeing: trips.wellbeingStatus,
    })
    .from(tripDestinations)
    .innerJoin(trips, eq(trips.id, tripDestinations.tripId))
    .where(scopeD);
  const active = regs.filter((r) => r.status === "active");
  const arrivals = regs.filter((r) => r.status === "planned" && r.arrival >= t && r.arrival <= week);
  const departures = regs.filter((r) => r.status === "active" && r.departure && r.departure >= t && r.departure <= week);

  const cases = await db
    .select({ status: assistanceCases.status, priority: assistanceCases.priority })
    .from(assistanceCases)
    .where(missionScope(user, assistanceCases.missionId));
  const openCases = cases.filter((c) => c.status !== "resolved");
  const urgent = openCases.filter((c) => c.priority === "urgent");

  const now = new Date();
  const [{ c: upcoming }] = await db
    .select({ c: count() })
    .from(appointments)
    .where(and(missionScope(user, appointments.missionId), eq(appointments.status, "booked"), gte(appointments.startsAt, now)));

  const crisis = await db
    .select({ id: crisisEvents.id, title: crisisEvents.title, targeted: crisisEvents.targetedCount })
    .from(crisisEvents)
    .where(and(missionScope(user, crisisEvents.missionId), eq(crisisEvents.status, "active")))
    .orderBy(desc(crisisEvents.sentAt));
  let responded = 0;
  let needHelp = 0;
  if (crisis.length) {
    const resp = await db
      .select({ response: crisisResponses.response })
      .from(crisisResponses)
      .where(inArray(crisisResponses.crisisEventId, crisis.map((c) => c.id)));
    responded = resp.filter((r) => r.response).length;
    needHelp = resp.filter((r) => r.response === "need_help").length;
  }

  // weekly registrations (last 8 weeks), de-duplicated by trip
  const seen = new Set<string>();
  const weeks: { label: string; value: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now.getTime() - (i + 1) * 7 * 86400e3);
    const end = new Date(now.getTime() - i * 7 * 86400e3);
    const label = start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    weeks.push({ label, value: 0 });
    for (const r of regs) {
      if (r.createdAt >= start && r.createdAt < end && !seen.has(r.tripId)) {
        seen.add(r.tripId);
        weeks[weeks.length - 1].value++;
      }
    }
  }
  const group = (rows: { [k: string]: unknown }[], key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const caseStatus = group(cases, "status");
  const feedbackRows = await db
    .select({ rating: feedback.rating, message: feedback.message, topic: feedback.topic, createdAt: feedback.createdAt })
    .from(feedback)
    .where(user.missionId ? eq(feedback.missionId, user.missionId) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(5);

  return {
    active: active.length,
    arrivals: arrivals.length,
    departures: departures.length,
    openCases: openCases.length,
    urgent: urgent.length,
    upcoming,
    crisis,
    responded,
    needHelp,
    weeks,
    byCountry: group(active, "country").slice(0, 8),
    byPurpose: group(active, "purpose"),
    caseStatus,
    wellbeingCounts: group(active.filter((r) => r.wellbeing), "wellbeing"),
    feedbackRows,
    totalRegs: regs.length,
  };
}

export async function missionOfficers(missionId: string) {
  return db
    .select({ id: users.id, name: users.displayName, role: users.role })
    .from(users)
    .where(and(eq(users.missionId, missionId), ne(users.role, "citizen")))
    .orderBy(asc(users.displayName));
}

export { sql };
