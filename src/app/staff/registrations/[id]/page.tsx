import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistanceCases, citizenProfiles, dependants, tripEvents, users, wellbeingUpdates } from "@/db/schema";
import { TripStatusBadge, WellbeingBadge } from "@/components/citizen-bits";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, Card, DefList, Notice, PageHeader, SectionTitle, Timeline } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CASE_CATEGORIES, CASE_STATUS, PURPOSES, WELLBEING, can } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { loadTrips } from "@/lib/data";
import { trips } from "@/db/schema";
import { audit } from "@/lib/services";
import { UUID } from "@/lib/validation";

export const metadata: Metadata = { title: "Registration" };

export default async function RegistrationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireStaff();
  if (!can(user.role, "records.view")) return <AccessDenied permission="records.view" role={user.role} />;
  if (!UUID.test(id)) notFound();
  const [trip] = await loadTrips(eq(trips.id, id));
  // Jurisdiction check: staff only see trips with at least one destination served by their mission.
  const mine = trip?.destinations.filter((d) => d.missionId === user.missionId) ?? [];
  if (!trip || mine.length === 0) notFound();
  const [person] = await db.select({ u: users, p: citizenProfiles }).from(users).innerJoin(citizenProfiles, eq(citizenProfiles.userId, users.id)).where(eq(users.id, trip.userId));
  const [events, wellbeing, deps, cases] = await Promise.all([
    db.select().from(tripEvents).where(eq(tripEvents.tripId, id)).orderBy(desc(tripEvents.createdAt)),
    db.select().from(wellbeingUpdates).where(eq(wellbeingUpdates.tripId, id)).orderBy(desc(wellbeingUpdates.createdAt)),
    db.select().from(dependants).where(eq(dependants.tripId, id)),
    db.select().from(assistanceCases).where(and(eq(assistanceCases.userId, trip.userId), eq(assistanceCases.missionId, user.missionId!))).orderBy(desc(assistanceCases.createdAt)),
  ]);
  await audit(user, "registration.view", "trip", id, `Registration ${trip.reference} opened`);
  const history = [
    ...events.map((e) => ({ id: e.id, at: e.createdAt, title: e.summary, detail: undefined as string | undefined })),
    ...wellbeing.map((w) => ({ id: w.id, at: w.createdAt, title: `Wellbeing: ${WELLBEING[w.status].label}`, detail: w.note ?? undefined })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-2 text-sm"><Link href="/staff/registrations" className="underline">← Registrations</Link></p>
      <PageHeader title={person.p.fullName} eyebrow={`Registration ${trip.reference}`} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <TripStatusBadge status={trip.status} />
        {trip.wellbeingStatus ? <WellbeingBadge status={trip.wellbeingStatus} /> : <Badge>No wellbeing update</Badge>}
        <span className="text-sm text-navy-600">{trip.wellbeingUpdatedAt ? `Last update ${fmtDateTime(trip.wellbeingUpdatedAt)}` : ""}</span>
      </div>
      <Notice tone="info" className="mb-6">This record was logged as opened in the audit history. A missing or old wellbeing update does not indicate that the person is missing or in danger.</Notice>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle>Trip information</SectionTitle>
            <ul className="mb-4 space-y-2">
              {mine.map((d) => <li key={d.id} className="rounded-xl bg-navy-50 p-3"><p className="font-semibold text-navy-950">{d.country}{d.region ? ` – ${d.region}` : ""}</p><p className="text-sm text-navy-800">{fmtDate(d.arrivalDate)} → {d.departureDate ? fmtDate(d.departureDate) : "departure not set"}</p></li>)}
            </ul>
            {trip.destinations.length > mine.length && <p className="mb-3 text-xs text-navy-600">Other stops on this itinerary are handled by other missions and are not shown.</p>}
            <DefList items={[
              { label: "Purpose", value: PURPOSES[trip.purpose] ?? trip.purpose },
              { label: "Registered", value: fmtDateTime(trip.createdAt) },
              { label: "Arrival confirmed", value: trip.arrivalConfirmedAt ? fmtDateTime(trip.arrivalConfirmedAt) : "Not confirmed" },
              { label: "Closed", value: trip.closedAt ? fmtDateTime(trip.closedAt) : "—" },
              {
                label: "Stay & location (given for emergency use)",
                value:
                  trip.lodgingName || trip.accommodation
                    ? `${[trip.lodgingName, trip.accommodation].filter(Boolean).join(" · ")}${trip.lodgingLat != null && trip.lodgingLng != null ? ` · 📍 ${trip.lodgingPlace} (${trip.lodgingLat}, ${trip.lodgingLng})` : ""}`
                    : "Not provided",
              },
              { label: "Contact while abroad", value: [trip.contactPhone, trip.contactEmail].filter(Boolean).join(" · ") || "Not provided" },
              { label: "Dependants (with consent)", value: deps.length ? deps.map((d) => `${d.fullName} (${d.relationship})`).join(", ") : "None" },
            ]} />
          </Card>
          <Card>
            <SectionTitle>Status history</SectionTitle>
            <Timeline items={history.map((h) => ({ id: h.id, at: fmtDateTime(h.at), title: h.title, detail: h.detail }))} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <SectionTitle>Citizen contact</SectionTitle>
            <DefList cols={1} items={[
              { label: "Email", value: person.u.email },
              { label: "Phone", value: `${person.p.phoneDial} ${person.p.phoneNumber}` },
              { label: "Preferred language", value: person.p.preferredLanguage },
              { label: "Citizenship", value: person.p.citizenship },
            ]} />
            <p className="mt-3 text-xs text-navy-600">Emergency contacts are not shown here. They may only be used where the citizen asked, or to protect life.</p>
          </Card>
          <Card>
            <SectionTitle>Related assistance cases</SectionTitle>
            {cases.length === 0 ? <p className="text-sm text-navy-700">None.</p> : (
              <ul className="space-y-2">{cases.map((c) => <li key={c.id}><Link href={`/staff/cases/${c.id}`} className="font-semibold text-teal-800 underline">{CASE_CATEGORIES[c.category].label}</Link><br /><span className="text-xs text-navy-600">{c.reference}</span> <Badge tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</Badge></li>)}</ul>
            )}
            <p className="mt-3 text-xs text-navy-600">Travel status and case status are tracked separately.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
