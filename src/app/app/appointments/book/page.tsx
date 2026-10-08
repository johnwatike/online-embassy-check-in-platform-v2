import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gt } from "drizzle-orm";
import { bookAppointment } from "@/app/actions/citizen";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/form";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { currentDestination, getUserTrips, listMissionsWithJurisdictions, pickCurrentTrip } from "@/lib/data";
import { dayKey, fmtDayLong, fmtTime } from "@/lib/format";
import { UUID } from "@/lib/validation";

export const metadata: Metadata = { title: "Book an appointment" };
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ mission?: string; service?: string; reschedule?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireCitizen();
  const [missions, trips] = await Promise.all([listMissionsWithJurisdictions(), getUserTrips(user.id)]);
  const cur = pickCurrentTrip(trips);
  const defaultMission = (cur && currentDestination(cur)?.missionId) || missions[0]?.id;
  const mission = missions.find((m) => m.id === sp.mission) ?? missions.find((m) => m.id === defaultMission) ?? missions[0];
  const service = mission.services.find((s) => s.id === sp.service);
  const reschedule = sp.reschedule && UUID.test(sp.reschedule) ? sp.reschedule : "";

  const slots = service
    ? await db.select().from(appointments).where(and(eq(appointments.missionId, mission.id), eq(appointments.serviceId, service.id), eq(appointments.status, "available"), gt(appointments.startsAt, new Date(Date.now() + 3600e3)))).orderBy(asc(appointments.startsAt)).limit(60)
    : [];
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const k = dayKey(s.startsAt, mission.timezone);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-2 text-sm"><Link href="/app/appointments" className="underline">← Appointments</Link></p>
      <PageHeader title={reschedule ? "Reschedule your appointment" : "Book an appointment"} description="Choose a mission and service, review what to bring, then pick a time." />
      <Card>
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {reschedule && <input type="hidden" name="reschedule" value={reschedule} />}
          <div>
            <label htmlFor="mission" className="mb-1.5 block text-sm font-semibold text-navy-900">Embassy or consulate</label>
            <select id="mission" name="mission" defaultValue={mission.id} className="block min-h-11 w-full rounded-lg border border-navy-300 bg-white px-3 text-base">
              {missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="service" className="mb-1.5 block text-sm font-semibold text-navy-900">Service</label>
            <select id="service" name="service" defaultValue={service?.id ?? ""} className="block min-h-11 w-full rounded-lg border border-navy-300 bg-white px-3 text-base">
              <option value="">Choose a service…</option>
              {mission.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="min-h-11 rounded-lg bg-navy-900 px-5 font-semibold text-white hover:bg-navy-800">Show times</button>
        </form>
        <p className="mt-3 text-sm font-medium text-navy-800">All times are in the embassy&apos;s local time: <strong>{mission.timezone}</strong>.</p>
      </Card>

      {service && (
        <>
          <Card className="mt-6">
            <h2 className="text-lg font-semibold text-navy-950">{service.name}</h2>
            <p className="text-navy-700">{service.description} (about {service.durationMin} minutes)</p>
            <h3 className="mt-3 font-semibold text-navy-950">Documents to bring</h3>
            <ul className="mt-1 list-disc pl-5 text-navy-800">{service.documents.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="mt-2 text-xs text-navy-600">Requirements can change. The mission may ask for additional documents.</p>
          </Card>
          <div className="mt-6">
            {slots.length === 0 ? (
              <EmptyState title="No times available" icon="📅">There are no open times for this service right now. Try another service or mission, or check back later.</EmptyState>
            ) : (
              <ActionForm action={bookAppointment.bind(null, reschedule)} className="space-y-5">
                {[...byDay.entries()].map(([day, list], di) => (
                  <fieldset key={day} className="rounded-2xl border border-navy-200 bg-white p-4">
                    <legend className="px-2 font-semibold text-navy-950">{fmtDayLong(list[0].startsAt, mission.timezone)}</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {list.map((s, i) => (
                        <label key={s.id} className="cursor-pointer rounded-lg border-2 border-navy-200 px-4 py-2.5 font-semibold text-navy-900 hover:border-navy-400 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal-700">
                          <input type="radio" name="slotId" value={s.id} required={di === 0 && i === 0} className="sr-only" />
                          {fmtTime(s.startsAt, mission.timezone)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <Notice tone="info">You&apos;ll get a confirmation reference straight away. You can reschedule or cancel from your appointments page.</Notice>
                <SubmitButton variant="teal" size="lg" pendingLabel="Booking…">{reschedule ? "Confirm new time" : "Book appointment"}</SubmitButton>
              </ActionForm>
            )}
          </div>
        </>
      )}
    </div>
  );
}
