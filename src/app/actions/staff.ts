"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  alerts,
  appointments,
  assistanceCases,
  caseEvents,
  caseMessages,
  caseNotes,
  crisisEvents,
  crisisResponses,
  missionJurisdictions,
  missions,
  notifications,
  users,
  type Priority,
} from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { CASE_STATUS, COUNTRIES, PRIORITY, can, type Permission } from "@/lib/constants";
import { fmtDateTime, makeRef, todayStr, zonedToUtc } from "@/lib/format";
import { audit, findRecipients, notify } from "@/lib/services";
import type { ActionState, Mission, User } from "@/lib/types";
import { bool, fail, formObj, requiredText, shortText, UUID } from "@/lib/validation";

type Guard = { user: User; mission: Mission | null } | { state: ActionState };

async function guard(perm: Permission): Promise<Guard> {
  const { user, mission } = await requireStaff();
  if (!can(user.role, perm)) return { state: { error: "Your role does not have permission to do this. Ask a mission administrator." } };
  return { user, mission };
}

const refresh = () => revalidatePath("/staff", "layout");

async function staffCase(user: User, caseId: string) {
  if (!UUID.test(caseId) || !user.missionId) return null;
  const [c] = await db.select().from(assistanceCases).where(and(eq(assistanceCases.id, caseId), eq(assistanceCases.missionId, user.missionId))).limit(1);
  return c ?? null;
}

// ---------------------------------------------------------------------------
// Case management
// ---------------------------------------------------------------------------
export async function triageCase(caseId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("cases.manage");
  if ("state" in g) return g.state;
  const c = await staffCase(g.user, caseId);
  if (!c) return { error: "Case not found in your jurisdiction." };
  const parsed = z
    .object({
      priority: z.enum(Object.keys(PRIORITY) as [Priority, ...Priority[]]),
      status: z.enum(["submitted", "under_review", "awaiting_citizen", "in_progress"]),
      assigneeId: z.string().optional().default(""),
    })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  let assigneeName: string | null = null;
  if (d.assigneeId) {
    const [o] = await db.select().from(users).where(and(eq(users.id, d.assigneeId), eq(users.missionId, g.user.missionId!))).limit(1);
    if (!o || o.role === "citizen") return { error: "Choose an officer from your mission." };
    assigneeName = o.displayName;
  }
  const events: (typeof caseEvents.$inferInsert)[] = [];
  const base = { caseId, actorId: g.user.id, actorKind: "staff" as const };
  if (d.priority !== c.priority) events.push({ ...base, type: "priority", summary: `Priority changed to ${PRIORITY[d.priority].label}`, citizenVisible: false });
  if ((d.assigneeId || null) !== c.assignedToId) events.push({ ...base, type: "assigned", summary: d.assigneeId ? "Assigned to the consular assistance team" : "Unassigned", citizenVisible: true });
  if (d.status !== c.status) events.push({ ...base, type: "status", summary: c.status === "resolved" ? "Request reopened" : `Status changed to ${CASE_STATUS[d.status].label}`, citizenVisible: true });
  await db.update(assistanceCases).set({ priority: d.priority, status: d.status, assignedToId: d.assigneeId || null, ...(c.status === "resolved" ? { resolvedAt: null } : {}) }).where(eq(assistanceCases.id, caseId));
  if (events.length) await db.insert(caseEvents).values(events);
  if (d.assigneeId !== (c.assignedToId ?? "")) await audit(g.user, "case.assign", "case", caseId, `Case ${c.reference} ${assigneeName ? `assigned to ${assigneeName}` : "unassigned"}`);
  if (d.status !== c.status) {
    await audit(g.user, "case.status", "case", caseId, `Case ${c.reference} status changed to ${CASE_STATUS[d.status].label}`);
    await notify(c.userId, { kind: "case", title: `Update on ${c.reference}`, body: `Status: ${CASE_STATUS[d.status].label}. (Delivery simulated.)`, href: `/app/cases/${caseId}`, severity: d.status === "awaiting_citizen" ? "advisory" : "info" });
  }
  if (d.priority !== c.priority) await audit(g.user, "case.priority", "case", caseId, `Case ${c.reference} priority set to ${PRIORITY[d.priority].label}`);
  refresh();
  return { ok: true, message: events.length ? "Case updated." : "No changes to save." };
}

export async function staffReply(caseId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("cases.manage");
  if ("state" in g) return g.state;
  const c = await staffCase(g.user, caseId);
  if (!c) return { error: "Case not found in your jurisdiction." };
  const body = z.string().trim().min(1, "Write a reply").max(2000, "Keep replies under 2000 characters").safeParse(fd.get("body"));
  if (!body.success) return { error: body.error.issues[0].message, fieldErrors: { body: body.error.issues[0].message } };
  await db.insert(caseMessages).values({ caseId, authorId: g.user.id, authorKind: "staff", body: body.data });
  await db.insert(caseEvents).values({ caseId, actorId: g.user.id, actorKind: "staff", type: "reply", summary: "Embassy replied to the citizen", citizenVisible: true });
  if (c.status === "submitted") await db.update(assistanceCases).set({ status: "under_review" }).where(eq(assistanceCases.id, caseId));
  await notify(c.userId, { kind: "case", title: `New message on ${c.reference}`, body: "The embassy replied to your request. (Delivery simulated.)", href: `/app/cases/${caseId}` });
  await audit(g.user, "case.message", "case", caseId, `Staff message sent on ${c.reference}`);
  refresh();
  return { ok: true, message: "Reply sent to the citizen." };
}

export async function requestInfo(caseId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("cases.manage");
  if ("state" in g) return g.state;
  const c = await staffCase(g.user, caseId);
  if (!c) return { error: "Case not found in your jurisdiction." };
  const body = z.string().trim().min(5, "Describe what information you need").max(1500).safeParse(fd.get("body"));
  if (!body.success) return { error: body.error.issues[0].message, fieldErrors: { body: body.error.issues[0].message } };
  await db.insert(caseMessages).values({ caseId, authorId: g.user.id, authorKind: "staff", kind: "info_request", body: body.data });
  await db.update(assistanceCases).set({ status: "awaiting_citizen" }).where(eq(assistanceCases.id, caseId));
  await db.insert(caseEvents).values({ caseId, actorId: g.user.id, actorKind: "staff", type: "info_requested", summary: "Embassy requested more information", citizenVisible: true });
  await notify(c.userId, { kind: "case", title: `The embassy needs information on ${c.reference}`, body: "Please open your request to reply. (Delivery simulated.)", href: `/app/cases/${caseId}`, severity: "advisory" });
  await audit(g.user, "case.info_request", "case", caseId, `Information requested on ${c.reference}`);
  refresh();
  return { ok: true, message: "Information request sent. Status set to “Awaiting your response”." };
}

export async function addInternalNote(caseId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("cases.manage");
  if ("state" in g) return g.state;
  const c = await staffCase(g.user, caseId);
  if (!c) return { error: "Case not found in your jurisdiction." };
  const body = z.string().trim().min(2, "Write a note").max(2000).safeParse(fd.get("body"));
  if (!body.success) return { error: body.error.issues[0].message, fieldErrors: { body: body.error.issues[0].message } };
  await db.insert(caseNotes).values({ caseId, authorId: g.user.id, body: body.data });
  await db.insert(caseEvents).values({ caseId, actorId: g.user.id, actorKind: "staff", type: "note", summary: "Internal note added", citizenVisible: false });
  await audit(g.user, "case.note", "case", caseId, `Internal note added on ${c.reference}`);
  refresh();
  return { ok: true, message: "Internal note saved. The citizen cannot see it." };
}

export async function resolveCase(caseId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("cases.manage");
  if ("state" in g) return g.state;
  const c = await staffCase(g.user, caseId);
  if (!c) return { error: "Case not found in your jurisdiction." };
  const note = z.string().trim().min(10, "Write a resolution note (at least 10 characters)").max(1500).safeParse(fd.get("resolutionNote"));
  if (!note.success) return { error: note.error.issues[0].message, fieldErrors: { resolutionNote: note.error.issues[0].message } };
  await db.update(assistanceCases).set({ status: "resolved", resolutionNote: note.data, resolvedAt: new Date() }).where(eq(assistanceCases.id, caseId));
  await db.insert(caseEvents).values({ caseId, actorId: g.user.id, actorKind: "staff", type: "resolved", summary: "Request resolved", citizenVisible: true });
  await notify(c.userId, { kind: "case", title: `${c.reference} has been resolved`, body: "Open your request to read the resolution note. (Delivery simulated.)", href: `/app/cases/${caseId}` });
  await audit(g.user, "case.resolve", "case", caseId, `Case ${c.reference} resolved with resolution note`);
  refresh();
  return { ok: true, message: "Case resolved. The citizen can see your resolution note." };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
const alertSchema = z.object({
  id: z.string().optional().default(""),
  title: requiredText(140, "Title"),
  body: z.string().trim().min(10, "Write the message (at least 10 characters)").max(1500, "Keep alerts under 1500 characters"),
  category: z.enum(["safety", "travel_guidance", "service_update"], { message: "Choose a type" }),
  severity: z.enum(["info", "advisory", "warning", "critical"], { message: "Choose a severity" }),
  country: requiredText(80, "Country"),
  region: shortText(120).optional().default(""),
  audience: z.enum(["all", "active", "planned"]),
  expiresOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date").optional().default(""),
});

export async function saveAlert(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const intent = fd.get("intent") === "publish" ? "publish" : "draft";
  const g = await guard(intent === "publish" ? "alerts.publish" : "alerts.draft");
  if ("state" in g) return g.state;
  if (!g.user.missionId) return { error: "Only mission staff can create alerts." };
  const parsed = alertSchema.safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const juris = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, g.user.missionId));
  if (!juris.some((j) => j.country === d.country)) return { error: "You can only send alerts for countries your mission serves.", fieldErrors: { country: "Not in your jurisdiction" } };
  if (d.expiresOn && d.expiresOn < todayStr()) return { error: "The expiry date must be today or later.", fieldErrors: { expiresOn: "Must be today or later" } };
  const expiresAt = d.expiresOn ? new Date(`${d.expiresOn}T23:59:59Z`) : null;
  const values = { missionId: g.user.missionId, authorId: g.user.id, title: d.title, body: d.body, category: d.category, severity: d.severity, country: d.country, region: d.region || null, audience: d.audience, expiresAt };
  let id = d.id;
  if (id && UUID.test(id)) {
    const [ex] = await db.select().from(alerts).where(and(eq(alerts.id, id), eq(alerts.missionId, g.user.missionId))).limit(1);
    if (!ex || ex.status !== "draft") return { error: "Only drafts can be edited." };
    await db.update(alerts).set(values).where(eq(alerts.id, id));
  } else {
    const [a] = await db.insert(alerts).values(values).returning();
    id = a.id;
  }
  if (intent === "publish") {
    const recipients = await findRecipients({ missionId: g.user.missionId, country: d.country, region: d.region, audience: d.audience });
    await db.update(alerts).set({ status: "published", publishedAt: new Date(), recipientCount: recipients.length }).where(eq(alerts.id, id));
    await audit(g.user, "alert.publish", "alert", id, `Alert published: ${d.title} (${recipients.length} intended recipients, simulated delivery)`);
    refresh();
    redirect("/staff/alerts?notice=alert_published");
  }
  await audit(g.user, "alert.draft", "alert", id, `Alert draft saved: ${d.title}`);
  refresh();
  redirect("/staff/alerts?notice=alert_draft");
}

export async function publishAlert(id: string) {
  const g = await guard("alerts.publish");
  if ("state" in g || !g.user.missionId || !UUID.test(id)) redirect("/staff/alerts");
  const [a] = await db.select().from(alerts).where(and(eq(alerts.id, id), eq(alerts.missionId, g.user.missionId))).limit(1);
  if (a?.status === "draft") {
    const r = await findRecipients({ missionId: g.user.missionId, country: a.country, region: a.region, audience: a.audience });
    await db.update(alerts).set({ status: "published", publishedAt: new Date(), recipientCount: r.length }).where(eq(alerts.id, id));
    await audit(g.user, "alert.publish", "alert", id, `Alert published: ${a.title} (${r.length} intended recipients, simulated delivery)`);
  }
  refresh();
  redirect("/staff/alerts?notice=alert_published");
}

export async function expireAlert(id: string) {
  const g = await guard("alerts.publish");
  if ("state" in g || !g.user.missionId || !UUID.test(id)) redirect("/staff/alerts");
  const [a] = await db.update(alerts).set({ status: "expired", expiresAt: new Date() }).where(and(eq(alerts.id, id), eq(alerts.missionId, g.user.missionId), eq(alerts.status, "published"))).returning();
  if (a) await audit(g.user, "alert.expire", "alert", id, `Alert expired: ${a.title}`);
  refresh();
  redirect("/staff/alerts?notice=alert_expired");
}

// ---------------------------------------------------------------------------
// Crisis wellbeing checks
// ---------------------------------------------------------------------------
export async function createCrisis(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("crisis.manage");
  if ("state" in g) return g.state;
  if (!g.user.missionId) return { error: "Only mission staff can send wellbeing checks." };
  const parsed = z
    .object({
      title: requiredText(140, "Title"),
      description: z.string().trim().min(10, "Describe the situation (at least 10 characters)").max(1000),
      message: z.string().trim().min(20, "Write the message citizens will see (at least 20 characters)").max(1200),
      country: requiredText(80, "Country"),
      region: shortText(120).optional().default(""),
    })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const juris = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, g.user.missionId));
  if (!juris.some((j) => j.country === d.country)) return { error: "You can only target countries your mission serves.", fieldErrors: { country: "Not in your jurisdiction" } };
  const targets = await findRecipients({ missionId: g.user.missionId, country: d.country, region: d.region, audience: "active" });
  if (!targets.length) return { error: "No active registrations match this area, so nothing was sent. Check the country and region, or publish an alert instead." };
  const requestLocation = bool(fd, "requestLocation");
  const [ev] = await db.insert(crisisEvents).values({ missionId: g.user.missionId, createdById: g.user.id, title: d.title, description: d.description, message: d.message, country: d.country, region: d.region || null, requestLocation, targetedCount: targets.length }).returning();
  await db.insert(crisisResponses).values(targets.map((t) => ({ crisisEventId: ev.id, userId: t.userId, tripId: t.tripId })));
  await db.insert(notifications).values(targets.map((t) => ({ userId: t.userId, kind: "crisis" as const, title: `Wellbeing check: ${d.title}`, body: "Please tell the embassy whether you are safe. Replying is voluntary.", href: `/app/crisis/${ev.id}`, severity: "critical" as const })));
  await db.insert(alerts).values({ missionId: g.user.missionId, authorId: g.user.id, title: d.title, body: d.message, category: "crisis", severity: "critical", country: d.country, region: d.region || null, audience: "active", status: "published", publishedAt: new Date(), recipientCount: targets.length, crisisEventId: ev.id });
  await audit(g.user, "crisis.send", "crisis_event", ev.id, `Wellbeing check sent to ${targets.length} citizens (simulated delivery)`);
  refresh();
  redirect(`/staff/crisis/${ev.id}?notice=crisis_sent`);
}

export async function closeCrisis(id: string) {
  const g = await guard("crisis.manage");
  if ("state" in g || !g.user.missionId || !UUID.test(id)) redirect("/staff/crisis");
  const [ev] = await db.update(crisisEvents).set({ status: "closed", closedAt: new Date() }).where(and(eq(crisisEvents.id, id), eq(crisisEvents.missionId, g.user.missionId))).returning();
  if (ev) {
    await db.update(alerts).set({ status: "expired", expiresAt: new Date() }).where(and(eq(alerts.crisisEventId, id), eq(alerts.status, "published")));
    // Closing a check also removes the stored precise locations that were shared for this request only.
    await db.update(crisisResponses).set({ locationText: null, locationRevokedAt: new Date() }).where(and(eq(crisisResponses.crisisEventId, id), inArray(crisisResponses.response, ["safe", "need_help"])));
    await audit(g.user, "crisis.close", "crisis_event", id, "Crisis wellbeing check closed; shared locations purged");
  }
  refresh();
  redirect(`/staff/crisis/${id}?notice=crisis_closed`);
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
export async function createSlots(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("appointments.manage");
  if ("state" in g) return g.state;
  if (!g.mission) return { error: "Only mission staff can add slots." };
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
      time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
      serviceId: z.string().min(1, "Choose a service"),
      count: z.coerce.number().int().min(1, "At least 1").max(12, "At most 12 at once"),
    })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  if (d.date < todayStr()) return { error: "Choose a date in the future.", fieldErrors: { date: "Must be today or later" } };
  const svc = g.mission.services.find((s) => s.id === d.serviceId);
  if (!svc) return { error: "Choose one of your mission's services.", fieldErrors: { serviceId: "Unknown service" } };
  const start = zonedToUtc(d.date, d.time, g.mission.timezone);
  await db.insert(appointments).values(Array.from({ length: d.count }, (_, i) => ({ missionId: g.mission!.id, serviceId: svc.id, serviceName: svc.name, startsAt: new Date(start.getTime() + i * svc.durationMin * 60000), durationMin: svc.durationMin, status: "available" as const })));
  await audit(g.user, "appointment.slots_created", "appointment", null, `${d.count} slot(s) added for ${svc.name} on ${d.date}`);
  refresh();
  return { ok: true, message: `${d.count} slot${d.count === 1 ? "" : "s"} added (times are in ${g.mission.timezone}).` };
}

async function staffAppt(user: User, id: string) {
  if (!UUID.test(id) || !user.missionId) return null;
  const [a] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.missionId, user.missionId))).limit(1);
  return a ?? null;
}

export async function markAttendance(id: string, status: "attended" | "no_show") {
  const g = await guard("appointments.manage");
  if ("state" in g) redirect("/staff/appointments");
  const a = await staffAppt(g.user, id);
  if (a?.status === "booked") {
    await db.update(appointments).set({ status }).where(eq(appointments.id, id));
    await audit(g.user, "appointment.attendance", "appointment", id, `Appointment ${a.reference} marked ${status === "attended" ? "attended" : "did not attend"}`);
  }
  refresh();
}

export async function staffCancelAppointment(id: string) {
  const g = await guard("appointments.manage");
  if ("state" in g) redirect("/staff/appointments");
  const a = await staffAppt(g.user, id);
  if (a?.status === "booked" && a.userId) {
    await db.update(appointments).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "staff" }).where(eq(appointments.id, id));
    const [m] = await db.select().from(missions).where(eq(missions.id, a.missionId)).limit(1);
    await notify(a.userId, { kind: "appointment", title: "Your appointment was cancelled by the embassy", body: `${a.serviceName} on ${fmtDateTime(a.startsAt, m.timezone)} (${a.reference}). Please book another time. (Delivery simulated.)`, href: "/app/appointments", severity: "advisory" });
    await audit(g.user, "appointment.cancel", "appointment", id, `Appointment ${a.reference} cancelled by staff`);
  }
  refresh();
}

export async function deleteSlot(id: string) {
  const g = await guard("appointments.manage");
  if ("state" in g) redirect("/staff/appointments");
  const a = await staffAppt(g.user, id);
  if (a?.status === "available") {
    await db.delete(appointments).where(eq(appointments.id, id));
    await audit(g.user, "appointment.slot_removed", "appointment", id, "Available slot removed");
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Mission settings
// ---------------------------------------------------------------------------
async function missionGuard(missionId: string): Promise<{ user: User; mission: Mission } | { state: ActionState }> {
  const g = await guard("mission.edit");
  if ("state" in g) return g;
  if (!UUID.test(missionId)) return { state: { error: "Mission not found." } };
  if (g.user.role === "mission_admin" && g.user.missionId !== missionId) return { state: { error: "You can only edit your own mission." } };
  const [m] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1);
  if (!m) return { state: { error: "Mission not found." } };
  return { user: g.user, mission: m };
}

export async function saveMissionDetails(missionId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await missionGuard(missionId);
  if ("state" in g) return g.state;
  const parsed = z
    .object({
      name: requiredText(160, "Name"),
      address: requiredText(300, "Address"),
      timezone: requiredText(60, "Timezone").refine((tz) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Use an IANA timezone such as Europe/Lisbon"),
      phone: requiredText(40, "Phone"),
      emergencyPhone: requiredText(40, "Emergency phone"),
      email: z.string().trim().email("Enter a valid email").max(200),
      website: z.string().trim().url("Enter a full website address starting with https://").max(200),
      openingHours: requiredText(400, "Opening hours"),
    })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const verify = bool(fd, "verify");
  await db.update(missions).set({ ...parsed.data, ...(verify ? { lastVerifiedAt: new Date() } : {}) }).where(eq(missions.id, missionId));
  await audit(g.user, verify ? "mission.verify" : "mission.update", "mission", missionId, verify ? "Mission details updated and marked as verified" : "Mission details updated", missionId);
  refresh();
  revalidatePath("/embassies");
  return { ok: true, message: verify ? "Saved and marked as verified today." : "Saved. Remember to re-verify contact details when you have checked them." };
}

export async function addJurisdiction(missionId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await missionGuard(missionId);
  if ("state" in g) return g.state;
  const parsed = z.object({ country: z.enum(COUNTRIES as [string, ...string[]], { message: "Choose a country" }), region: shortText(80).optional().default("") }).safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const existing = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.country, parsed.data.country));
  if (existing.some((j) => (j.region ?? "") === parsed.data.region && j.missionId === missionId)) return { error: "This country/region is already listed." };
  const clash = existing.find((j) => (j.region ?? "") === parsed.data.region && j.missionId !== missionId);
  if (clash) return { error: "Another mission already serves this exact country/region. Ask a platform administrator to resolve the overlap." };
  await db.insert(missionJurisdictions).values({ missionId, country: parsed.data.country, region: parsed.data.region || null });
  await audit(g.user, "mission.jurisdiction_add", "mission", missionId, `Jurisdiction added: ${parsed.data.country}${parsed.data.region ? ` / ${parsed.data.region}` : ""}`, missionId);
  refresh();
  revalidatePath("/embassies");
  return { ok: true, message: "Country added to the jurisdiction. Existing registrations are not moved automatically." };
}

export async function removeJurisdiction(missionId: string, id: string) {
  const g = await missionGuard(missionId);
  if ("state" in g || !UUID.test(id)) return;
  await db.delete(missionJurisdictions).where(and(eq(missionJurisdictions.id, id), eq(missionJurisdictions.missionId, missionId)));
  await audit(g.user, "mission.jurisdiction_remove", "mission", missionId, "Jurisdiction entry removed", missionId);
  refresh();
  revalidatePath("/embassies");
}

export async function saveService(missionId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await missionGuard(missionId);
  if ("state" in g) return g.state;
  const parsed = z
    .object({
      id: z.string().optional().default(""),
      name: requiredText(120, "Service name"),
      description: requiredText(300, "Description"),
      documents: z.string().trim().max(1500).optional().default(""),
      durationMin: z.coerce.number().int().min(5, "At least 5 minutes").max(180, "At most 180 minutes"),
    })
    .safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const documents = d.documents.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12);
  const id = d.id || `svc-${makeRef("S").slice(2).toLowerCase()}`;
  const services = g.mission.services.filter((s) => s.id !== id);
  services.push({ id, name: d.name, description: d.description, documents, durationMin: d.durationMin });
  await db.update(missions).set({ services }).where(eq(missions.id, missionId));
  await audit(g.user, "mission.service_save", "mission", missionId, `Service saved: ${d.name}`, missionId);
  refresh();
  return { ok: true, message: "Service saved." };
}

export async function removeService(missionId: string, serviceId: string) {
  const g = await missionGuard(missionId);
  if ("state" in g) return;
  await db.update(missions).set({ services: g.mission.services.filter((s) => s.id !== serviceId) }).where(eq(missions.id, missionId));
  await audit(g.user, "mission.service_remove", "mission", missionId, "Service removed", missionId);
  refresh();
}
