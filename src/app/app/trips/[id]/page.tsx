import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { cancelTrip, checkOutTrip, confirmArrival, extendStay } from "@/app/actions/citizen";
import { db } from "@/db";
import { tripEvents, wellbeingUpdates } from "@/db/schema";
import { TripStatusBadge, WellbeingBadge, dateRange, tripTitle } from "@/components/citizen-bits";
import { ConfirmDialog } from "@/components/dialog";
import { ActionButton, ActionForm, SubmitButton, TextField } from "@/components/form";
import { MissionContact } from "@/components/mission-card";
import { ButtonLink, Card, DefList, Flash, Notice, PageHeader, SectionTitle, Timeline } from "@/components/ui";
import { PURPOSES, TRIP_STATUS, WELLBEING, FALLBACK_CONTACT } from "@/lib/constants";
import { requireCitizen } from "@/lib/auth";
import { getTripDependants, getUserTrip } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Trip details" };

export default async function TripDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { user } = await requireCitizen();
  const trip = await getUserTrip(user.id, id);
  if (!trip) notFound();
  const [events, wellbeing, deps] = await Promise.all([
    db.select().from(tripEvents).where(eq(tripEvents.tripId, id)).orderBy(desc(tripEvents.createdAt)),
    db.select().from(wellbeingUpdates).where(eq(wellbeingUpdates.tripId, id)).orderBy(desc(wellbeingUpdates.createdAt)),
    getTripDependants(id),
  ]);
  const open = trip.status === "planned" || trip.status === "active";
  const lastDest = trip.destinations[trip.destinations.length - 1];
  const history = [
    ...events.map((e) => ({ id: e.id, at: e.createdAt, title: e.summary, detail: undefined as string | undefined })),
    ...wellbeing.map((w) => ({ id: w.id, at: w.createdAt, title: `Wellbeing: ${WELLBEING[w.status].label}`, detail: [w.source === "crisis_response" ? "Sent in reply to a wellbeing check" : "", w.note ?? ""].filter(Boolean).join(" · ") || undefined })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-2 text-sm"><Link href="/app/trips" className="underline">← My trips</Link></p>
      <Flash notice={notice} />
      {notice === "created" && (
        <Card className="mb-6 border-2 border-teal-600 bg-teal-50/60">
          <h2 className="font-serif text-2xl font-semibold text-navy-950">Check-in receipt</h2>
          <p className="mt-1 text-navy-800">Keep this reference. A copy is in your alerts and activity timeline (delivery by email/SMS is simulated in this demo).</p>
          <p className="mt-3 font-mono text-3xl font-bold tracking-wider text-navy-950" aria-label={`Confirmation reference ${trip.reference}`}>{trip.reference}</p>
          <p className="mt-2 text-navy-800">{tripTitle(trip)} · {dateRange(trip.startsOn, trip.endsOn)} · Registered {fmtDateTime(trip.createdAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2"><ButtonLink href="/app/card" variant="outline" size="sm">Open my emergency contact card</ButtonLink><ButtonLink href="/app/status" variant="outline" size="sm">Update my status</ButtonLink></div>
        </Card>
      )}
      <PageHeader
        title={tripTitle(trip)}
        eyebrow={`Trip ${trip.reference}`}
        description={TRIP_STATUS[trip.status].help}
        actions={open ? <ButtonLink href={`/app/trips/${id}/edit`} variant="outline">Edit details</ButtonLink> : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <TripStatusBadge status={trip.status} />
        {trip.wellbeingStatus && <WellbeingBadge status={trip.wellbeingStatus} />}
        {trip.wellbeingUpdatedAt && <span className="text-sm text-navy-600">Last wellbeing update {fmtDateTime(trip.wellbeingUpdatedAt)}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle>Itinerary</SectionTitle>
            <ol className="space-y-4">
              {trip.destinations.map((d, i) => (
                <li key={d.id} className="rounded-xl bg-navy-50 p-4">
                  <p className="text-lg font-semibold text-navy-950">{trip.destinations.length > 1 ? `${i + 1}. ` : ""}{d.country}{d.region ? ` – ${d.region}` : ""}</p>
                  <p className="text-navy-800">{dateRange(d.arrivalDate, d.departureDate)}</p>
                  <p className="mt-1 text-sm text-navy-700">{d.mission ? `Responsible mission: ${d.mission.name}${d.mission.country !== d.country ? ` (no resident Kenyan mission in ${d.country}; served from ${d.mission.city})` : ""}` : `No mission covers ${d.country} in this demo.`}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5"><DefList items={[
              { label: "Purpose", value: PURPOSES[trip.purpose] ?? trip.purpose },
              { label: "Accommodation", value: trip.accommodation || "Not provided" },
              { label: "Contact while abroad", value: [trip.contactPhone, trip.contactEmail].filter(Boolean).join(" · ") || "Not provided" },
              { label: "Arrival confirmed", value: trip.arrivalConfirmedAt ? fmtDateTime(trip.arrivalConfirmedAt) : "Not yet" },
              { label: "Dependants", value: deps.length ? deps.map((d) => `${d.fullName} (${d.relationship})`).join(", ") : "None" },
              { label: "Closed", value: trip.closedAt ? fmtDateTime(trip.closedAt) : "—" },
            ]} /></div>
          </Card>

          {open && (
            <Card>
              <SectionTitle>Manage this trip</SectionTitle>
              <div className="space-y-6">
                {trip.status === "planned" && (
                  <div>
                    <h3 className="font-semibold text-navy-950">Have you arrived?</h3>
                    <p className="mb-2 text-sm text-navy-700">Confirming arrival makes this trip active and lets the embassy send alerts for your location.</p>
                    <ActionButton variant="teal" size="md" action={confirmArrival.bind(null, id)}>Confirm arrival</ActionButton>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-navy-950">Extend or shorten your stay</h3>
                  <ActionForm action={extendStay.bind(null, id)} className="mt-2 max-w-md">
                    <TextField label="New expected departure date" name="endsOn" type="date" required defaultValue={trip.endsOn ?? ""} min={lastDest.arrivalDate} />
                    <SubmitButton variant="outline" pendingLabel="Saving…">Update departure date</SubmitButton>
                  </ActionForm>
                </div>
                <div>
                  <h3 className="font-semibold text-navy-950">Change destination or details</h3>
                  <p className="mb-2 text-sm text-navy-700">Fix a mistake, switch destination, add another country or change your contact details.</p>
                  <ButtonLink href={`/app/trips/${id}/edit`} variant="outline">Edit trip</ButtonLink>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-navy-100 pt-4">
                  {trip.status === "active" && (
                    <ConfirmDialog triggerLabel="I've left – close this trip" title="Close this trip?" description="Your trip will be marked as closed and your wellbeing set to “left the country”. Nothing is deleted – you can still see this trip and its history." confirmLabel="Close trip" action={checkOutTrip.bind(null, id)} confirmVariant="primary" />
                  )}
                  {trip.status === "planned" && (
                    <ConfirmDialog triggerLabel="Cancel registration" title="Cancel this registration?" description="Use this if you're no longer travelling. The record stays in your history as cancelled." confirmLabel="Cancel registration" confirmVariant="danger" action={cancelTrip.bind(null, id)} />
                  )}
                </div>
              </div>
            </Card>
          )}
          <Card>
            <SectionTitle>History</SectionTitle>
            <Timeline items={history.map((h) => ({ id: h.id, at: fmtDateTime(h.at), title: h.title, detail: h.detail }))} />
          </Card>
        </div>
        <div className="space-y-6">
          {(() => {
            const d = trip.destinations.find((x) => x.mission) ?? lastDest;
            return d?.mission ? <MissionContact mission={d.mission} destinationCountry={d.country} /> : (
              <Notice tone="warning" title="No embassy route for this destination">In an emergency contact local services first, then {FALLBACK_CONTACT.name} on {FALLBACK_CONTACT.phone} (demo placeholder).</Notice>
            );
          })()}
          <Notice tone="info">Registration helps the embassy communicate with you. It does not replace visas or immigration registration, or local emergency services. Record last updated {fmtDate(trip.updatedAt)}.</Notice>
          <div className="flex flex-col gap-2">
            <ButtonLink href="/app/status" variant="outline">Update my status</ButtonLink>
            <ButtonLink href="/app/help" variant="outline">Get help</ButtonLink>
            <ButtonLink href="/app/card" variant="outline">Emergency contact card</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
void asc;
