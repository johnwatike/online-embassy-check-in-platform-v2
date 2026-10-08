import type { Metadata } from "next";
import Link from "next/link";
import { confirmArrival } from "@/app/actions/citizen";
import { ActionButton } from "@/components/form";
import { AlertCard, TripStatusBadge, WellbeingBadge, dateRange, tripTitle } from "@/components/citizen-bits";
import { MissionContact } from "@/components/mission-card";
import { Badge, ButtonLink, Card, EmptyState, Flash, Notice, SectionTitle, Timeline } from "@/components/ui";
import { CASE_CATEGORIES, CASE_STATUS, FALLBACK_CONTACT } from "@/lib/constants";
import { requireCitizen } from "@/lib/auth";
import { currentDestination, getTimeline, getUserAppointments, getUserCases, getUserTrips, pendingCrisis, pickCurrentTrip, relevantAlerts } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getLang, tr, type Key } from "@/lib/i18n";

export const metadata: Metadata = { title: "Dashboard" };

const ACTIONS_BASE = [
  { href: "/app/trips/new", icon: "✓", title: "Check in", text: "Register a trip or confirm arrival", cls: "bg-teal-700 text-white hover:bg-teal-800" },
  { href: "/app/status", icon: "♥", title: "Update my status", text: "Tell the embassy you're safe", cls: "bg-navy-900 text-white hover:bg-navy-800" },
  { href: "/app/help", icon: "?", title: "Get help", text: "Request consular assistance", cls: "bg-white text-navy-950 border border-navy-200 hover:border-teal-600" },
  { href: "/app/embassy", icon: "✉", title: "Contact my embassy", text: "Details, hours, appointments", cls: "bg-white text-navy-950 border border-navy-200 hover:border-teal-600" },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string; notice?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const t = (k: Key) => tr(lang, k);
  const titleKeys: Key[] = ["nav.checkIn", "nav.status", "nav.help", "nav.embassy"];
  const textKeys: Key[] = ["dash.a1d", "dash.a2d", "dash.a3d", "dash.a4d"];
  const ACTIONS = ACTIONS_BASE.map((a, i) => ({ ...a, title: t(titleKeys[i]), text: t(textKeys[i]) }));
  const { user, profile } = await requireCitizen();
  const [trips, alerts, cases, appts, timeline, crisis] = await Promise.all([getUserTrips(user.id), relevantAlerts(user.id), getUserCases(user.id), getUserAppointments(user.id), getTimeline(user.id, 8), pendingCrisis(user.id)]);
  const trip = pickCurrentTrip(trips);
  const dest = trip ? currentDestination(trip) : undefined;
  const openCases = cases.filter((c) => c.c.status !== "resolved");
  const upcoming = appts.filter((a) => a.a.status === "booked" && a.a.startsAt > new Date());
  const upcomingTrips = trips.filter((t) => t.status === "planned" && t.id !== trip?.id);

  return (
    <div className="mx-auto max-w-7xl">
      <Flash notice={sp.notice} />
      {sp.welcome && <div className="mb-5"><Notice tone="success" title="Welcome to Embassy Connect (demo)">Your demo account is ready. Start by checking in for a trip — or explore the embassy directory.</Notice></div>}
      {crisis.map(({ e, mission }) => (
        <div key={e.id} className="mb-5" role="alert">
          <Notice tone="danger" title={`Wellbeing check from ${mission}: ${e.title}`}>
            The embassy asks everyone in the affected area whether they are safe. Replying is voluntary, and not replying will never be treated as a sign you are in danger.
            <div className="mt-2"><ButtonLink href={`/app/crisis/${e.id}`} variant="danger" size="sm">Respond now</ButtonLink></div>
          </Notice>
        </div>
      ))}

      <h1 className="font-serif text-3xl font-semibold text-navy-950 sm:text-4xl">{t("dash.hello")}, {profile.fullName.split(" ")[0]}</h1>
      <p className="mt-1 text-navy-700">{t("dash.sub")}</p>

      <nav aria-label="Main actions" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className={`flex min-h-28 flex-col justify-between rounded-2xl p-4 shadow-sm transition ${a.cls}`}>
            <span aria-hidden className="text-2xl">{a.icon}</span>
            <span><span className="block text-lg font-semibold leading-tight">{a.title}</span><span className="block text-sm opacity-90">{a.text}</span></span>
          </Link>
        ))}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {trip && dest ? (
            <Card>
              <SectionTitle action={<Link className="text-sm font-semibold text-teal-800 underline" href={`/app/trips/${trip.id}`}>View trip</Link>}>Current trip</SectionTitle>
              <p className="font-serif text-2xl font-semibold text-navy-950">{tripTitle(trip)}</p>
              <p className="text-navy-700">{dest.region ? `${dest.region} · ` : ""}{dateRange(trip.startsOn, trip.endsOn)}</p>
              <p className="mt-1 text-sm text-navy-600">Reference {trip.reference}</p>

              <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-navy-600">Three separate statuses</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-navy-50 p-3">
                  <p className="text-xs font-medium text-navy-600">Travel registration</p>
                  <div className="mt-1"><TripStatusBadge status={trip.status} /></div>
                  <p className="mt-1 text-xs text-navy-700">Departure: {trip.endsOn ? fmtDate(trip.endsOn) : "not set"}</p>
                </div>
                <div className="rounded-xl bg-navy-50 p-3">
                  <p className="text-xs font-medium text-navy-600">Wellbeing</p>
                  <div className="mt-1">{trip.wellbeingStatus ? <WellbeingBadge status={trip.wellbeingStatus} /> : <Badge>No update yet</Badge>}</div>
                  <p className="mt-1 text-xs text-navy-700">{trip.wellbeingUpdatedAt ? `Updated ${fmtDateTime(trip.wellbeingUpdatedAt)}` : "Update anytime"}</p>
                </div>
                <div className="rounded-xl bg-navy-50 p-3">
                  <p className="text-xs font-medium text-navy-600">Assistance requests</p>
                  <div className="mt-1"><Badge tone={openCases.length ? "amber" : "neutral"}>{openCases.length ? `${openCases.length} open` : "None open"}</Badge></div>
                  <p className="mt-1 text-xs text-navy-700">Wellbeing updates don&apos;t change cases</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {trip.status === "planned" && <ActionButton variant="teal" size="md" action={confirmArrival.bind(null, trip.id)}>Confirm I&apos;ve arrived</ActionButton>}
                <ButtonLink href="/app/status" variant="outline">Update my status</ButtonLink>
                <ButtonLink href={`/app/trips/${trip.id}`} variant="ghost">Extend, edit or close trip</ButtonLink>
              </div>
            </Card>
          ) : (
            <EmptyState title="You have no active trip" icon="🧳" action={<ButtonLink href="/app/trips/new" variant="teal">Check in for a trip</ButtonLink>}>
              Register before you travel, or check in after arrival, so your embassy can send you relevant alerts and help if you ask. It only takes a couple of minutes.
            </EmptyState>
          )}

          <Card>
            <SectionTitle action={<Link className="text-sm font-semibold text-teal-800 underline" href="/app/alerts">All alerts</Link>}>Alerts for where you are</SectionTitle>
            {alerts.length === 0 ? <p className="text-navy-700">No active alerts for your destinations. We&apos;ll notify you if something changes.</p> : <div className="space-y-3">{alerts.slice(0, 3).map((a) => <AlertCard key={a.id} alert={a} />)}</div>}
          </Card>

          <Card>
            <SectionTitle>Recent activity</SectionTitle>
            <Timeline items={timeline.map((t, i) => ({ id: `${i}-${t.at.getTime()}`, at: fmtDateTime(t.at), title: t.title, detail: t.detail }))} />
          </Card>
        </div>

        <div className="space-y-6">
          {dest?.mission ? (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-navy-950">Your embassy</h2>
              <MissionContact mission={dest.mission} destinationCountry={dest.country} />
            </div>
          ) : trip && dest ? (
            <Notice tone="warning" title={`No mission covers ${dest.country} in this demo`}>
              In an emergency, contact local emergency services, then {FALLBACK_CONTACT.name}: {FALLBACK_CONTACT.phone} (demo placeholder).
            </Notice>
          ) : null}

          <Card>
            <SectionTitle action={<Link className="text-sm font-semibold text-teal-800 underline" href="/app/help">Get help</Link>}>Open assistance requests</SectionTitle>
            {openCases.length === 0 ? <p className="text-sm text-navy-700">No open requests.</p> : (
              <ul className="space-y-3">
                {openCases.map(({ c }) => (
                  <li key={c.id}>
                    <Link href={`/app/cases/${c.id}`} className="block rounded-xl border border-navy-100 p-3 hover:border-teal-600">
                      <p className="text-sm font-semibold text-navy-950">{CASE_CATEGORIES[c.category].label}</p>
                      <p className="text-xs text-navy-600">{c.reference}</p>
                      <div className="mt-1"><Badge tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</Badge></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle action={<Link className="text-sm font-semibold text-teal-800 underline" href="/app/appointments">Manage</Link>}>Upcoming appointments</SectionTitle>
            {upcoming.length === 0 ? <p className="text-sm text-navy-700">No upcoming appointments.</p> : (
              <ul className="space-y-3">
                {upcoming.map(({ a, mission }) => (
                  <li key={a.id} className="rounded-xl bg-navy-50 p-3 text-sm">
                    <p className="font-semibold text-navy-950">{a.serviceName}</p>
                    <p>{fmtDateTime(a.startsAt, mission.timezone)}</p>
                    <p className="text-xs text-navy-600">{mission.name} · times in {mission.timezone}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {upcomingTrips.length > 0 && (
            <Card>
              <SectionTitle>Upcoming trips</SectionTitle>
              <ul className="space-y-2 text-sm">{upcomingTrips.map((t) => <li key={t.id}><Link className="font-semibold text-teal-800 underline" href={`/app/trips/${t.id}`}>{tripTitle(t)}</Link><br />{dateRange(t.startsOn, t.endsOn)}</li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
