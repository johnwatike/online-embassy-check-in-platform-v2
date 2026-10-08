import type { Metadata } from "next";
import { cancelAppointment } from "@/app/actions/citizen";
import { ConfirmDialog } from "@/components/dialog";
import { Badge, ButtonLink, Card, EmptyState, Flash, PageHeader, SectionTitle } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { APPT_STATUS } from "@/lib/constants";
import { getUserAppointments } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { user } = await requireCitizen();
  const all = await getUserAppointments(user.id);
  const now = new Date();
  const upcoming = all.filter((a) => a.a.status === "booked" && a.a.startsAt > now);
  const history = all.filter((a) => !upcoming.includes(a)).sort((x, y) => y.a.startsAt.getTime() - x.a.startsAt.getTime());
  return (
    <div className="mx-auto max-w-4xl">
      <Flash notice={notice} />
      <PageHeader title="Appointments" description="Consular appointments are in the embassy's local time, which is always shown." actions={<ButtonLink href="/app/appointments/book" variant="teal">Book an appointment</ButtonLink>} />
      <SectionTitle>Upcoming</SectionTitle>
      {upcoming.length === 0 ? <EmptyState title="No upcoming appointments" icon="📅" action={<ButtonLink href="/app/appointments/book" variant="teal">Book now</ButtonLink>}>Choose a service and a time that suits you.</EmptyState> : (
        <ul className="space-y-4">
          {upcoming.map(({ a, mission }) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone="navy">Confirmed</Badge>
                    <h3 className="mt-1 text-lg font-semibold text-navy-950">{a.serviceName}</h3>
                    <p className="text-navy-900">{fmtDateTime(a.startsAt, mission.timezone)} · {a.durationMin} min</p>
                    <p className="text-sm text-navy-700">{mission.name}, {mission.address}</p>
                    <p className="text-sm font-medium text-navy-800">Embassy timezone: {mission.timezone}</p>
                    <p className="mt-1 text-sm text-navy-600">Confirmation reference: <span className="font-mono font-semibold">{a.reference}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/app/appointments/book?mission=${a.missionId}&service=${a.serviceId}&reschedule=${a.id}`} variant="outline" size="sm">Reschedule</ButtonLink>
                    <ConfirmDialog triggerLabel="Cancel" triggerSize="sm" title="Cancel this appointment?" description={<>Your {a.serviceName} appointment on {fmtDateTime(a.startsAt, mission.timezone)} will be cancelled and the time released for others.</>} confirmLabel="Cancel appointment" confirmVariant="danger" action={cancelAppointment.bind(null, a.id)} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <SectionTitle>History</SectionTitle>
      {history.length === 0 ? <p className="text-navy-700">Nothing here yet.</p> : (
        <ul className="divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white">
          {history.map(({ a, mission }) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div><p className="font-semibold text-navy-950">{a.serviceName}</p><p className="text-sm text-navy-700">{fmtDateTime(a.startsAt, mission.timezone)} · {mission.city} · {a.reference}</p></div>
              <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
