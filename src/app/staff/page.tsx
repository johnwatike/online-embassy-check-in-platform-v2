import type { Metadata } from "next";
import Link from "next/link";
import { BarList, Card, ColumnChart, Notice, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { MissionScopeNote } from "@/components/staff-bits";
import { requireStaff } from "@/lib/auth";
import { CASE_STATUS, PURPOSES, ROLE_LABEL, WELLBEING, can } from "@/lib/constants";
import { addDays, fmtDate, todayStr } from "@/lib/format";
import { dashboardStats } from "@/lib/staff-data";

export const metadata: Metadata = { title: "Staff dashboard" };

export default async function StaffDashboard() {
  const { user, mission } = await requireStaff();
  const s = await dashboardStats(user);
  const records = can(user.role, "records.view");
  const cases = can(user.role, "cases.manage");
  const crisisAccess = can(user.role, "crisis.view");
  const aggregateOnly = user.role === "platform_admin";
  const link = (ok: boolean, href: string) => (ok ? href : undefined);
  const crisis = s.crisis[0];
  const avg = s.feedbackRows.length ? (s.feedbackRows.reduce((a, b) => a + b.rating, 0) / s.feedbackRows.length).toFixed(1) : "–";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Staff dashboard" eyebrow={mission?.name ?? "All missions"} description={`Signed in as ${ROLE_LABEL[user.role]} (demo). Figures are aggregate counts as of ${fmtDate(todayStr())}.`} />
      <MissionScopeNote name={mission?.name ?? null} />
      {aggregateOnly && <Notice tone="info" className="mb-5" title="Aggregate view">Platform administrators see totals across missions. Counts below 5 are shown as “&lt;5” in breakdowns to avoid exposing individuals.</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active travel registrations" value={s.active} href={link(records, "/staff/registrations?status=active")} hint={`${s.totalRegs} total registrations`} />
        <Stat label="Arrivals in next 7 days" value={s.arrivals} href={link(records, `/staff/registrations?status=planned&to=${addDays(7)}&sort=arrival&dir=asc`)} hint="Registered, not yet confirmed" />
        <Stat label="Departures in next 7 days" value={s.departures} href={link(records, "/staff/registrations?status=active&sort=departure&dir=asc")} hint="Sorted by departure date" />
        <Stat label="Upcoming appointments" value={s.upcoming} href={link(can(user.role, "appointments.manage"), "/staff/appointments?view=list")} />
        <Stat label="Open assistance cases" value={s.openCases} href={link(cases, "/staff/cases?open=1")} />
        <Stat label="Urgent cases" value={s.urgent} tone={s.urgent ? "red" : "neutral"} href={link(cases, "/staff/cases?open=1&priority=urgent")} />
        <Stat label="Crisis wellbeing responses" value={crisis ? `${s.responded}/${crisis.targeted}` : "–"} href={link(crisisAccess, crisis ? `/staff/crisis/${crisis.id}` : "/staff/crisis")} hint={crisis ? `${s.needHelp} asked for help · non-responses are not a concern signal` : "No active check"} tone={s.needHelp ? "red" : "neutral"} />
        <Stat label="Feedback rating (latest)" value={avg} hint={`${s.feedbackRows.length} recent responses`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><SectionTitle>New registrations per week</SectionTitle><ColumnChart items={s.weeks} title="New registrations per week, last 8 weeks" /></Card>
        <Card><SectionTitle>Active registrations by country</SectionTitle><BarList items={s.byCountry} suppress={aggregateOnly} /></Card>
        <Card><SectionTitle>Purpose of travel (active)</SectionTitle><BarList items={s.byPurpose} labelMap={PURPOSES} suppress={aggregateOnly} /></Card>
        <Card><SectionTitle>Assistance cases by status</SectionTitle><BarList items={s.caseStatus} labelMap={Object.fromEntries(Object.entries(CASE_STATUS).map(([k, v]) => [k, v.label]))} suppress={aggregateOnly} /></Card>
        <Card><SectionTitle>Latest wellbeing status (active trips)</SectionTitle><BarList items={s.wellbeingCounts} labelMap={Object.fromEntries(Object.entries(WELLBEING).map(([k, v]) => [k, v.short]))} suppress={aggregateOnly} />
          <p className="mt-3 text-xs text-navy-600">Citizens who haven&apos;t updated are simply not counted here. No update never means someone is missing.</p></Card>
        <Card>
          <SectionTitle>Citizen feedback</SectionTitle>
          {s.feedbackRows.length === 0 ? <p className="text-sm text-navy-600">No feedback yet.</p> : (
            <ul className="space-y-3 text-sm">{s.feedbackRows.map((f, i) => <li key={i}><p className="font-semibold text-navy-950">{"★".repeat(f.rating)}<span className="text-navy-300">{"★".repeat(5 - f.rating)}</span> <span className="font-normal text-navy-600">· {f.topic} · {fmtDate(f.createdAt)}</span></p><p className="text-navy-800">{f.message}</p></li>)}</ul>
          )}
          <p className="mt-3 text-xs text-navy-600">Feedback is shown without names.</p>
        </Card>
      </div>
      {crisis && crisisAccess && (
        <Notice tone="warning" className="mt-6" title={`Active wellbeing check: ${crisis.title}`}>
          {s.responded} of {crisis.targeted} responded; {s.needHelp} asked for help. <Link className="underline" href={`/staff/crisis/${crisis.id}`}>Open responses</Link>
        </Notice>
      )}
    </div>
  );
}
