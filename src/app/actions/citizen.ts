"use server";

import { and, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, withTransaction } from "@/db";
import {
  alertReads,
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
  feedback,
  missions,
  notificationPreferences,
  notifications,
  tripDestinations,
  tripEvents,
  trips,
  users,
  wellbeingUpdates,
  type CaseCategory,
} from "@/db/schema";
import { requireCitizen } from "@/lib/auth";
import { CASE_CATEGORIES, DIAL_CODES, LANGUAGES, PURPOSES, WELLBEING } from "@/lib/constants";
import { currentDestination, getUserTrip, loadTrips, relevantAlerts } from "@/lib/data";
import { addDays, fmtDate, fmtDateTime, makeRef, todayStr } from "@/lib/format";
import { geocodePlace } from "@/lib/geo";
import { resolveRouting } from "@/lib/routing";
import { audit, loadRouting, notify } from "@/lib/services";
import type { ActionState, User } from "@/lib/types";
import { bool, dateStr, fail, formObj, optionalDate, optionalEmail, phoneText, requiredText, shortText, UUID } from "@/lib/validation";

const done = () => revalidatePath("/app", "layout");

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------
const tripSchema = z.object({
  stage: z.enum(["planning", "arrived"]).default("planning"),
  purpose: z.enum(Object.keys(PURPOSES) as [string, ...string[]], { message: "Choose a purpose of travel" }),
  destinations: z
    .array(
      z.object({
        country: requiredText(80, "Country"),
        region: shortText(120).optional().default(""),
        arrivalDate: dateStr,
        departureDate: optionalDate,
      }),
    )
    .min(1, "Add at least one destination")
    .max(8),
  accommodation: shortText(300).optional().default(""),
  lodgingName: shortText(200).optional().default(""),
  contactPhone: phoneText,
  contactEmail: optionalEmail,
  dependants: z
    .array(
      z.object({
        fullName: requiredText(120, "Dependant name"),
        relationship: requiredText(60, "Relationship"),
        birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
        consent: z.literal(true, { message: "Consent is required for each dependant" }),
      }),
    )
    .max(8)
    .default([]),
  prefs: z.object({ email: z.boolean(), sms: z.boolean(), push: z.boolean(), reminders: z.boolean() }).optional(),
});
type TripInput = z.infer<typeof tripSchema>;

function parseTrip(fd: FormData): { data: TripInput } | { state: ActionState } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    return { state: { error: "We couldn't read the form. Please try again." } };
  }
  const parsed = tripSchema.safeParse(raw);
  if (!parsed.success) return { state: fail(parsed.error) };
  return { data: parsed.data };
}

/** Coordinates are always (re)computed server-side from the stay details – never trusted from the client. */
function lodgingFields(d: TripInput) {
  const geo = geocodePlace(`${d.lodgingName} ${d.accommodation} ${d.destinations[0].region}`, d.destinations[0].country);
  return { lodgingName: d.lodgingName || null, lodgingPlace: geo?.place ?? null, lodgingLat: geo?.lat ?? null, lodgingLng: geo?.lng ?? null };
}

/** Live preview for the check-in wizard: auto-pick coordinates for the entered stay address. */
export async function geocodeStay(query: string, country: string) {
  return geocodePlace(query, country);
}

function checkDates(d: TripInput, mode: "create" | "edit"): string | null {
  const today = todayStr();
  const ds = d.destinations;
  for (let i = 0; i < ds.length; i++) {
    const x = ds[i];
    const label = ds.length > 1 ? `Stop ${i + 1}: ` : "";
    if (x.departureDate && x.departureDate < x.arrivalDate) return `${label}departure can't be before arrival.`;
    if (i < ds.length - 1 && !x.departureDate) return `${label}add a departure date, because you travel on to another country.`;
    if (i > 0 && x.arrivalDate < ds[i - 1].arrivalDate) return `${label}arrival can't be before the previous stop's arrival.`;
    if (x.departureDate && x.departureDate > addDays(365 * 5)) return `${label}the departure date is too far in the future.`;
  }
  if (mode === "create") {
    if (d.stage === "planning" && ds[0].arrivalDate < today) return "For a trip that hasn't started, the arrival date must be today or later. If you're already there, choose 'I've already arrived'.";
    if (d.stage === "arrived" && ds[0].arrivalDate > today) return "You can't confirm arrival on a future date. Choose 'I'm planning to travel' instead.";
  }
  return null;
}

async function savePrefs(userId: string, p: NonNullable<TripInput["prefs"]>) {
  await db
    .insert(notificationPreferences)
    .values({ userId, email: p.email, sms: p.sms, push: p.push, reminders: p.reminders })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { email: p.email, sms: p.sms, push: p.push, reminders: p.reminders } });
}

export async function createTrip(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const p = parseTrip(fd);
  if ("state" in p) return p.state;
  const d = p.data;
  const dateErr = checkDates(d, "create");
  if (dateErr) return { error: dateErr };

  const routing = await loadRouting();
  const reference = makeRef("TRV");
  const arrived = d.stage === "arrived";
  const last = d.destinations[d.destinations.length - 1];
  const [trip] = await db
    .insert(trips)
    .values({
      reference,
      userId: user.id,
      status: arrived ? "active" : "planned",
      purpose: d.purpose,
      startsOn: d.destinations[0].arrivalDate,
      endsOn: last.departureDate || null,
      accommodation: d.accommodation || null,
      ...lodgingFields(d),
      contactPhone: d.contactPhone || null,
      contactEmail: d.contactEmail || null,
      arrivalConfirmedAt: arrived ? new Date() : null,
    })
    .returning();
  await db.insert(tripDestinations).values(
    d.destinations.map((x, i) => ({
      tripId: trip.id,
      position: i,
      country: x.country,
      region: x.region || null,
      missionId: resolveRouting(routing, x.country, x.region)?.missionId ?? null,
      arrivalDate: x.arrivalDate,
      departureDate: x.departureDate || null,
    })),
  );
  if (d.dependants.length) {
    await db.insert(dependants).values(
      d.dependants.map((x) => ({ userId: user.id, tripId: trip.id, fullName: x.fullName, relationship: x.relationship, birthYear: x.birthYear ?? null, consentConfirmedAt: new Date() })),
    );
  }
  await db.insert(tripEvents).values([
    { tripId: trip.id, userId: user.id, type: "registered", summary: `Trip ${reference} registered` },
    ...(arrived ? [{ tripId: trip.id, userId: user.id, type: "arrival_confirmed", summary: "Arrival confirmed at registration" }] : []),
  ]);
  if (d.prefs) await savePrefs(user.id, d.prefs);
  await notify(user.id, { kind: "trip", title: "Check-in receipt", body: `Reference ${reference}. ${arrived ? "You are registered as arrived." : "You are registered as upcoming."} (Delivery simulated.)`, href: `/app/trips/${trip.id}` });
  await audit(user, "trip.create", "trip", trip.id, `Trip ${reference} registered`);
  done();
  redirect(`/app/trips/${trip.id}?notice=created`);
}

export async function updateTrip(tripId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const existing = await getUserTrip(user.id, tripId);
  if (!existing || !["planned", "active"].includes(existing.status)) return { error: "This trip can no longer be edited." };
  const p = parseTrip(fd);
  if ("state" in p) return p.state;
  const d = p.data;
  const dateErr = checkDates(d, "edit");
  if (dateErr) return { error: dateErr };

  const routing = await loadRouting();
  const last = d.destinations[d.destinations.length - 1];
  const oldFirst = existing.destinations[0];
  await db
    .update(trips)
    .set({ purpose: d.purpose, startsOn: d.destinations[0].arrivalDate, endsOn: last.departureDate || null, accommodation: d.accommodation || null, ...lodgingFields(d), contactPhone: d.contactPhone || null, contactEmail: d.contactEmail || null })
    .where(and(eq(trips.id, tripId), eq(trips.userId, user.id)));
  await db.delete(tripDestinations).where(eq(tripDestinations.tripId, tripId));
  await db.insert(tripDestinations).values(
    d.destinations.map((x, i) => ({
      tripId,
      position: i,
      country: x.country,
      region: x.region || null,
      missionId: resolveRouting(routing, x.country, x.region)?.missionId ?? null,
      arrivalDate: x.arrivalDate,
      departureDate: x.departureDate || null,
    })),
  );
  if (d.dependants.length) {
    await db.insert(dependants).values(d.dependants.map((x) => ({ userId: user.id, tripId, fullName: x.fullName, relationship: x.relationship, birthYear: x.birthYear ?? null, consentConfirmedAt: new Date() })));
  }
  const changedDest = oldFirst && (oldFirst.country !== d.destinations[0].country || (oldFirst.region ?? "") !== d.destinations[0].region);
  await db.insert(tripEvents).values({ tripId, userId: user.id, type: changedDest ? "destination_changed" : "edited", summary: changedDest ? `Destination changed to ${d.destinations[0].country}` : "Trip details updated" });
  if (d.prefs) await savePrefs(user.id, d.prefs);
  await audit(user, "trip.update", "trip", tripId, `Trip ${existing.reference} details corrected`);
  done();
  redirect(`/app/trips/${tripId}?notice=saved`);
}

export async function confirmArrival(tripId: string) {
  const { user } = await requireCitizen();
  const t = await getUserTrip(user.id, tripId);
  if (t?.status === "planned") {
    await db.update(trips).set({ status: "active", arrivalConfirmedAt: new Date() }).where(eq(trips.id, tripId));
    await db.insert(tripEvents).values({ tripId, userId: user.id, type: "arrival_confirmed", summary: "Arrival confirmed" });
    await notify(user.id, { kind: "trip", title: "Arrival confirmed", body: `Trip ${t.reference} is now active. (Delivery simulated.)`, href: `/app/trips/${tripId}` });
    await audit(user, "trip.arrival", "trip", tripId, `Arrival confirmed for ${t.reference}`);
  }
  done();
  redirect(`/app/trips/${tripId}?notice=arrival`);
}

export async function extendStay(tripId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const t = await getUserTrip(user.id, tripId);
  if (!t || !["planned", "active"].includes(t.status)) return { error: "This trip can't be changed." };
  const parsed = dateStr.safeParse(fd.get("endsOn"));
  if (!parsed.success) return { error: "Enter a valid new departure date.", fieldErrors: { endsOn: "Enter a valid date" } };
  const lastDest = t.destinations[t.destinations.length - 1];
  if (parsed.data < lastDest.arrivalDate) return { error: "The departure date can't be before your arrival.", fieldErrors: { endsOn: "Must be on or after arrival" } };
  if (parsed.data > addDays(365 * 5)) return { error: "That date is too far in the future.", fieldErrors: { endsOn: "Too far in the future" } };
  await db.update(tripDestinations).set({ departureDate: parsed.data }).where(eq(tripDestinations.id, lastDest.id));
  await db.update(trips).set({ endsOn: parsed.data }).where(eq(trips.id, tripId));
  await db.insert(tripEvents).values({ tripId, userId: user.id, type: "extended", summary: `Expected departure changed from ${fmtDate(t.endsOn, "unknown")} to ${fmtDate(parsed.data)}` });
  await audit(user, "trip.extend", "trip", tripId, `Departure date changed for ${t.reference}`);
  done();
  return { ok: true, message: `Departure date updated to ${fmtDate(parsed.data)}. A receipt is in your timeline.` };
}

async function closeTrip(userId: string, tripId: string, reference: string) {
  await db.update(trips).set({ status: "closed", closedAt: new Date(), wellbeingStatus: "left_country", wellbeingUpdatedAt: new Date() }).where(eq(trips.id, tripId));
  await db.insert(wellbeingUpdates).values({ userId, tripId, status: "left_country", note: null });
  await db.insert(tripEvents).values({ tripId, userId, type: "closed", summary: "Trip closed after departure" });
  await notify(userId, { kind: "trip", title: "Trip closed", body: `Trip ${reference} has been closed. Your history is kept. (Delivery simulated.)`, href: `/app/trips/${tripId}` });
}

export async function checkOutTrip(tripId: string) {
  const { user } = await requireCitizen();
  const t = await getUserTrip(user.id, tripId);
  if (t && ["planned", "active"].includes(t.status)) {
    await closeTrip(user.id, tripId, t.reference);
    await audit(user, "trip.close", "trip", tripId, `Trip ${t.reference} closed`);
  }
  done();
  redirect(`/app/trips/${tripId}?notice=closed`);
}

export async function cancelTrip(tripId: string) {
  const { user } = await requireCitizen();
  const t = await getUserTrip(user.id, tripId);
  if (t?.status === "planned") {
    await db.update(trips).set({ status: "cancelled", closedAt: new Date() }).where(eq(trips.id, tripId));
    await db.insert(tripEvents).values({ tripId, userId: user.id, type: "cancelled", summary: "Registration cancelled before travel" });
    await audit(user, "trip.cancel", "trip", tripId, `Trip ${t.reference} cancelled`);
  }
  done();
  redirect(`/app/trips/${tripId}?notice=cancelled`);
}

// ---------------------------------------------------------------------------
// Wellbeing status & assistance cases
// ---------------------------------------------------------------------------
const urgencyToPriority = { urgent: "urgent", soon: "high", routine: "normal" } as const;

async function attachmentFrom(fd: FormData): Promise<{ error: string } | { file: { filename: string; mimeType: string; size: number; data: string } } | null> {
  const f = fd.get("attachment");
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 2 * 1024 * 1024) return { error: "The attachment is larger than 2 MB." };
  const buf = Buffer.from(await f.arrayBuffer());
  const isPdf = buf.subarray(0, 4).toString("latin1") === "%PDF";
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG";
  const mime = isPdf ? "application/pdf" : isJpg ? "image/jpeg" : isPng ? "image/png" : null;
  if (!mime) return { error: "Attachments must be PDF, JPG or PNG files." };
  return { file: { filename: f.name.replace(/[^\w.\- ]/g, "_").slice(0, 100) || "attachment", mimeType: mime, size: f.size, data: buf.toString("base64") } };
}

async function openCase(
  user: Pick<User, "id" | "displayName" | "role" | "missionId">,
  o: { category: CaseCategory; description: string; location: string; contactMethod: "email" | "sms" | "phone"; contactDetail: string | null; urgency: "urgent" | "soon" | "routine"; tripId: string | null; missionId: string },
  attachment?: { filename: string; mimeType: string; size: number; data: string } | null,
) {
  const reference = makeRef("CASE");
  const [c] = await db
    .insert(assistanceCases)
    .values({ reference, userId: user.id, tripId: o.tripId, missionId: o.missionId, category: o.category, description: o.description, location: o.location, contactMethod: o.contactMethod, contactDetail: o.contactDetail, citizenUrgency: o.urgency, priority: urgencyToPriority[o.urgency] })
    .returning();
  await db.insert(caseEvents).values({ caseId: c.id, actorId: user.id, actorKind: "citizen", type: "submitted", summary: "Request submitted by citizen" });
  if (attachment) await db.insert(caseAttachments).values({ caseId: c.id, filename: attachment.filename, mimeType: attachment.mimeType, sizeBytes: attachment.size, dataBase64: attachment.data });
  await notify(user.id, { kind: "case", title: `Request ${reference} received`, body: "Your request has been received. This is not a guarantee of an immediate response. (Delivery simulated.)", href: `/app/cases/${c.id}` });
  await audit(user, "case.create", "case", c.id, `Assistance request ${reference} created (${o.category})`, o.missionId);
  return c;
}

const wellbeingSchema = z.object({
  tripId: z.string().regex(UUID, "Choose a trip"),
  status: z.enum(["safe", "plans_changed", "need_assistance", "left_country"], { message: "Choose how you're doing" }),
  note: shortText(500, "The note").optional().default(""),
});

export async function postWellbeing(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, profile } = await requireCitizen();
  const parsed = wellbeingSchema.safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const trip = await getUserTrip(user.id, d.tripId);
  if (!trip || !["planned", "active"].includes(trip.status)) return { error: "Choose one of your current trips." };

  if (d.status === "need_assistance") {
    if (!bool(fd, "acknowledge")) return { error: "Please confirm you understand how online requests work.", fieldErrors: { acknowledge: "Please confirm to continue" } };
    const location = String(fd.get("location") ?? "").trim();
    if (location.length < 2) return { error: "Tell us where you are so the embassy can help.", fieldErrors: { location: "Enter your current location" } };
    const dest = currentDestination(trip);
    if (!dest?.missionId) return { error: `No mission in this demo covers ${dest?.country ?? "this destination"}. Use "Get urgent help" for local emergency numbers and the fallback operations contact.` };
    const method = z.enum(["email", "sms", "phone"]).catch("phone").parse(fd.get("contactMethod"));
    await db.insert(wellbeingUpdates).values({ userId: user.id, tripId: trip.id, status: "need_assistance", note: d.note || null });
    await db.update(trips).set({ wellbeingStatus: "need_assistance", wellbeingUpdatedAt: new Date() }).where(eq(trips.id, trip.id));
    const c = await openCase(user, { category: "other", description: d.note || "I need assistance (sent from a status update).", location, contactMethod: method, contactDetail: method === "email" ? user.email : `${profile.phoneDial} ${profile.phoneNumber}`, urgency: "urgent", tripId: trip.id, missionId: dest.missionId });
    done();
    redirect(`/app/cases/${c.id}?notice=case_created`);
  }

  const [w] = await db.insert(wellbeingUpdates).values({ userId: user.id, tripId: trip.id, status: d.status, note: d.note || null }).returning();
  if (d.status === "left_country" && bool(fd, "closeTrip")) {
    await closeTrip(user.id, trip.id, trip.reference);
    await audit(user, "trip.close", "trip", trip.id, `Trip ${trip.reference} closed`);
    done();
    redirect(`/app/trips/${trip.id}?notice=closed`);
  }
  await db.update(trips).set({ wellbeingStatus: d.status, wellbeingUpdatedAt: new Date() }).where(eq(trips.id, trip.id));
  done();
  const receipt = w.id.slice(0, 8).toUpperCase();
  const extra = d.status === "plans_changed" ? " Remember to update your trip dates or destination if they changed." : "";
  return { ok: true, message: `Update recorded: "${WELLBEING[d.status].label}". Receipt WU-${receipt}, ${fmtDateTime(w.createdAt)}.${extra} Your assistance cases are not affected by this update.` };
}

const caseSchema = z.object({
  category: z.enum(Object.keys(CASE_CATEGORIES) as [CaseCategory, ...CaseCategory[]], { message: "Choose a category" }),
  description: z.string().trim().min(10, "Please describe what is happening (at least 10 characters)").max(2000, "Please keep this under 2000 characters"),
  location: requiredText(200, "Your location"),
  contactMethod: z.enum(["email", "sms", "phone"], { message: "Choose a contact method" }),
  contactDetail: shortText(120).optional().default(""),
  urgency: z.enum(["urgent", "soon", "routine"], { message: "Choose how urgent this is" }),
  tripId: z.string().optional().default(""),
  country: z.string().optional().default(""),
});

export async function createCase(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, profile } = await requireCitizen();
  const parsed = caseSchema.safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  if (!bool(fd, "acknowledge")) return { error: "Please confirm that you understand how online requests work.", fieldErrors: { acknowledge: "Please confirm to continue" } };

  let missionId: string | null = null;
  let tripId: string | null = null;
  if (d.tripId && UUID.test(d.tripId)) {
    const trip = await getUserTrip(user.id, d.tripId);
    if (!trip) return { error: "We couldn't find that trip." };
    tripId = trip.id;
    missionId = currentDestination(trip)?.missionId ?? null;
  } else {
    if (!d.country) return { error: "Choose the country you need help in.", fieldErrors: { country: "Choose a country" } };
    missionId = resolveRouting(await loadRouting(), d.country, d.location)?.missionId ?? null;
  }
  if (!missionId) return { error: "No mission in this demo covers that destination. Use “Get urgent help” for the fallback operations contact and local emergency numbers." };

  const att = await attachmentFrom(fd);
  if (att && "error" in att) return { error: att.error, fieldErrors: { attachment: att.error } };
  const contactDetail = d.contactDetail || (d.contactMethod === "email" ? user.email : `${profile.phoneDial} ${profile.phoneNumber}`);
  const c = await openCase(user, { category: d.category, description: d.description, location: d.location, contactMethod: d.contactMethod, contactDetail, urgency: d.urgency, tripId, missionId }, att?.file);
  done();
  redirect(`/app/cases/${c.id}?notice=case_created`);
}

export async function postCaseMessage(caseId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const body = z.string().trim().min(1, "Write a message").max(2000, "Please keep messages under 2000 characters").safeParse(fd.get("body"));
  if (!body.success) return { error: body.error.issues[0].message, fieldErrors: { body: body.error.issues[0].message } };
  const [c] = await db.select().from(assistanceCases).where(and(eq(assistanceCases.id, caseId), eq(assistanceCases.userId, user.id))).limit(1);
  if (!c) return { error: "Request not found." };
  if (c.status === "resolved") return { error: "This request is resolved. Please submit a new request if you need more help." };
  await db.insert(caseMessages).values({ caseId, authorId: user.id, authorKind: "citizen", body: body.data });
  if (c.status === "awaiting_citizen") {
    await db.update(assistanceCases).set({ status: "under_review" }).where(eq(assistanceCases.id, caseId));
    await db.insert(caseEvents).values({ caseId, actorId: user.id, actorKind: "citizen", type: "citizen_replied", summary: "Citizen replied; status changed to Under review" });
  } else {
    await db.insert(caseEvents).values({ caseId, actorId: user.id, actorKind: "citizen", type: "citizen_replied", summary: "Citizen sent a message" });
  }
  await audit(user, "case.message", "case", caseId, `Citizen message on ${c.reference}`, c.missionId);
  done();
  revalidatePath(`/app/cases/${caseId}`);
  return { ok: true, message: "Message sent securely." };
}

// ---------------------------------------------------------------------------
// Crisis wellbeing checks
// ---------------------------------------------------------------------------
export async function respondCrisis(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const answer = z.enum(["safe", "need_help", "not_affected"], { message: "Choose a response" }).safeParse(fd.get("response"));
  if (!answer.success) return { error: "Please choose a response.", fieldErrors: { response: "Choose a response" } };
  const [row] = await db
    .select({ r: crisisResponses, e: crisisEvents })
    .from(crisisResponses)
    .innerJoin(crisisEvents, eq(crisisEvents.id, crisisResponses.crisisEventId))
    .where(and(eq(crisisResponses.crisisEventId, eventId), eq(crisisResponses.userId, user.id)))
    .limit(1);
  if (!row) return { error: "This request was not sent to you." };
  if (row.e.status !== "active") return { error: "This wellbeing check has been closed." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  const share = row.e.requestLocation && bool(fd, "shareLocation") && answer.data !== "not_affected";
  const loc = String(fd.get("locationText") ?? "").trim().slice(0, 200);
  if (share && loc.length < 2) return { error: "Enter your approximate location, or untick the location option.", fieldErrors: { locationText: "Enter a location or untick sharing" } };
  const now = new Date();
  await db
    .update(crisisResponses)
    .set({
      response: answer.data,
      note: note || null,
      respondedAt: now,
      locationText: share ? loc : null,
      locationConsentAt: share ? now : row.r.locationConsentAt,
      locationRevokedAt: !share && row.r.locationText ? now : null,
    })
    .where(eq(crisisResponses.id, row.r.id));
  if (answer.data !== "not_affected" && row.r.tripId) {
    const status = answer.data === "safe" ? "safe" : "need_assistance";
    await db.insert(wellbeingUpdates).values({ userId: user.id, tripId: row.r.tripId, status, note: note || null, source: "crisis_response" });
    await db.update(trips).set({ wellbeingStatus: status, wellbeingUpdatedAt: now }).where(eq(trips.id, row.r.tripId));
  }
  await db.update(notifications).set({ readAt: now }).where(and(eq(notifications.userId, user.id), eq(notifications.href, `/app/crisis/${eventId}`)));
  await audit(user, "crisis.respond", "crisis_event", eventId, `Crisis response recorded${share ? " (location shared by consent)" : ""}`, row.e.missionId);
  done();
  redirect(`/app/crisis/${eventId}?notice=responded`);
}

export async function withdrawLocation(eventId: string) {
  const { user } = await requireCitizen();
  const [r] = await db.select().from(crisisResponses).where(and(eq(crisisResponses.crisisEventId, eventId), eq(crisisResponses.userId, user.id))).limit(1);
  if (r?.locationText) {
    await db.update(crisisResponses).set({ locationText: null, locationRevokedAt: new Date() }).where(eq(crisisResponses.id, r.id));
    await audit(user, "crisis.location_revoked", "crisis_event", eventId, "Citizen withdrew shared location");
  }
  done();
  redirect(`/app/crisis/${eventId}?notice=saved`);
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
export async function bookAppointment(rescheduleId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const slotId = String(fd.get("slotId") ?? "");
  if (!UUID.test(slotId)) return { error: "Choose a date and time first.", fieldErrors: { slotId: "Choose a time slot" } };
  const result = await withTransaction(async (tx) => {
    const [slot] = await tx
      .update(appointments)
      .set({ status: "booked", userId: user.id, reference: makeRef("APT"), bookedAt: new Date() })
      .where(and(eq(appointments.id, slotId), eq(appointments.status, "available"), gt(appointments.startsAt, new Date())))
      .returning();
    if (!slot) return null;
    if (rescheduleId && UUID.test(rescheduleId)) {
      const [old] = await tx.update(appointments).set({ status: "rescheduled" }).where(and(eq(appointments.id, rescheduleId), eq(appointments.userId, user.id), eq(appointments.status, "booked"))).returning();
      if (old) await tx.insert(appointments).values({ missionId: old.missionId, serviceId: old.serviceId, serviceName: old.serviceName, startsAt: old.startsAt, durationMin: old.durationMin, status: "available" });
    }
    const [m] = await tx.select().from(missions).where(eq(missions.id, slot.missionId)).limit(1);
    return { slot, tz: m.timezone, name: m.name };
  });
  if (!result) return { error: "Sorry, that time was just taken or is no longer available. Please choose another." };
  await notify(user.id, { kind: "appointment", title: "Appointment confirmed", body: `${result.slot.serviceName} · ${fmtDateTime(result.slot.startsAt, result.tz)} at ${result.name}. Ref ${result.slot.reference}. (Delivery simulated.)`, href: "/app/appointments" });
  await audit(user, "appointment.book", "appointment", result.slot.id, `Appointment ${result.slot.reference} booked${rescheduleId ? " (rescheduled)" : ""}`, result.slot.missionId);
  done();
  redirect("/app/appointments?notice=booked");
}

export async function cancelAppointment(id: string) {
  const { user } = await requireCitizen();
  const [a] = await db.update(appointments).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "citizen" }).where(and(eq(appointments.id, id), eq(appointments.userId, user.id), eq(appointments.status, "booked"))).returning();
  if (a) {
    await db.insert(appointments).values({ missionId: a.missionId, serviceId: a.serviceId, serviceName: a.serviceName, startsAt: a.startsAt, durationMin: a.durationMin, status: "available" });
    await notify(user.id, { kind: "appointment", title: "Appointment cancelled", body: `Your ${a.serviceName} appointment (${a.reference}) was cancelled. (Delivery simulated.)`, href: "/app/appointments" });
    await audit(user, "appointment.cancel", "appointment", a.id, `Appointment ${a.reference} cancelled by citizen`, a.missionId);
  }
  done();
  redirect("/app/appointments?notice=appt_cancelled");
}

// ---------------------------------------------------------------------------
// Alerts & notifications
// ---------------------------------------------------------------------------
export async function markAlertRead(alertId: string) {
  const { user } = await requireCitizen();
  if (UUID.test(alertId)) await db.insert(alertReads).values({ alertId, userId: user.id }).onConflictDoNothing();
  done();
}

export async function markNotificationRead(id: string) {
  const { user } = await requireCitizen();
  if (UUID.test(id)) await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  done();
}

export async function markAllRead() {
  const { user } = await requireCitizen();
  const list = await relevantAlerts(user.id, true);
  const unread = list.filter((a) => !a.readAt);
  if (unread.length) await db.insert(alertReads).values(unread.map((a) => ({ alertId: a.id, userId: user.id }))).onConflictDoNothing();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), inArray(notifications.kind, ["case", "appointment", "crisis", "trip", "system"])));
  done();
  redirect("/app/alerts?notice=all_read");
}

// ---------------------------------------------------------------------------
// Profile, contacts, preferences, privacy, feedback
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  fullName: requiredText(120, "Full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  citizenship: requiredText(60, "Citizenship"),
  phoneDial: z.enum(DIAL_CODES as [string, ...string[]], { message: "Choose a dialling code" }),
  phoneNumber: phoneText.refine((v) => v.length >= 4, "Enter a phone number"),
  preferredLanguage: z.enum(LANGUAGES as [string, ...string[]], { message: "Choose a language" }),
});

export async function saveProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const parsed = profileSchema.safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  if (d.email !== user.email) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
    if (taken) return { error: "That email is already used by another demo account.", fieldErrors: { email: "Already in use" } };
  }
  await db.update(users).set({ displayName: d.fullName, email: d.email }).where(eq(users.id, user.id));
  await db.update(citizenProfiles).set({ fullName: d.fullName, citizenship: d.citizenship, phoneDial: d.phoneDial, phoneNumber: d.phoneNumber, preferredLanguage: d.preferredLanguage }).where(eq(citizenProfiles.userId, user.id));
  await audit(user, "profile.update", "user", user.id, "Profile details updated");
  done();
  return { ok: true, message: "Profile saved." };
}

export async function addEmergencyContact(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const parsed = z
    .object({ name: requiredText(120, "Name"), relationship: requiredText(60, "Relationship"), phone: phoneText.refine((v) => v.length >= 4, "Enter a phone number"), email: optionalEmail })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const existing = await db.select({ id: emergencyContacts.id }).from(emergencyContacts).where(eq(emergencyContacts.userId, user.id));
  if (existing.length >= 3) return { error: "You can store up to 3 emergency contacts. Remove one first." };
  await db.insert(emergencyContacts).values({ userId: user.id, name: parsed.data.name, relationship: parsed.data.relationship, phone: parsed.data.phone, email: parsed.data.email || null });
  await audit(user, "contact.add", "emergency_contact", null, "Emergency contact added");
  done();
  return { ok: true, message: "Emergency contact added. It is not shared automatically." };
}

export async function removeEmergencyContact(id: string) {
  const { user } = await requireCitizen();
  if (UUID.test(id)) await db.delete(emergencyContacts).where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, user.id)));
  await audit(user, "contact.remove", "emergency_contact", id, "Emergency contact removed");
  done();
}

export async function saveNotificationPrefs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const freq = z.enum(["off", "weekly", "fortnightly", "monthly", "before_departure"]).catch("monthly").parse(fd.get("reminderFrequency"));
  const values = { email: bool(fd, "email"), sms: bool(fd, "sms"), push: bool(fd, "push"), urgentOverride: bool(fd, "urgentOverride"), reminders: freq !== "off", reminderFrequency: freq };
  await db.insert(notificationPreferences).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: notificationPreferences.userId, set: values });
  done();
  return { ok: true, message: "Notification settings saved. Delivery is simulated in this demo." };
}

export async function requestDeletion() {
  const { user } = await requireCitizen();
  await db.update(users).set({ deletionRequestedAt: new Date() }).where(eq(users.id, user.id));
  await audit(user, "privacy.deletion_request", "user", user.id, "Citizen requested deletion of their data");
  done();
  redirect("/app/profile?notice=deletion#privacy");
}

export async function cancelDeletion() {
  const { user } = await requireCitizen();
  await db.update(users).set({ deletionRequestedAt: null }).where(eq(users.id, user.id));
  await audit(user, "privacy.deletion_withdrawn", "user", user.id, "Citizen withdrew deletion request");
  done();
  redirect("/app/profile?notice=deletion_cancelled#privacy");
}

export async function submitFeedback(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireCitizen();
  const parsed = z
    .object({
      missionId: z.string().regex(UUID, "Choose a mission"),
      rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
      topic: z.enum(["Website", "Alerts", "Appointments", "Case handling", "Other"], { message: "Choose a topic" }),
      message: z.string().trim().min(5, "Please write at least a few words").max(1000, "Please keep feedback under 1000 characters"),
    })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  await db.insert(feedback).values({ userId: user.id, ...parsed.data });
  done();
  return { ok: true, message: "Thank you. Your feedback was sent to the mission. It is not an assistance request and may not receive a reply." };
}

export async function loadActiveTrips(userId: string) {
  return loadTrips(and(eq(trips.userId, userId), inArray(trips.status, ["planned", "active"])));
}
