import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { closeCrisis } from "@/app/actions/staff";
import { db } from "@/db";
import { citizenProfiles, crisisEvents, crisisResponses, trips } from "@/db/schema";
import { ConfirmDialog } from "@/components/dialog";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, Card, Flash, Notice, PageHeader, SectionTitle, Stat, tableCls } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CRISIS_ANSWER, can } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { audit } from "@/lib/services";
import { UUID } from "@/lib/validation";

export const metadata: Metadata = { title: "Wellbeing check" };

export default async function CrisisDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { user, mission } = await requireStaff();
  if (!can(user.role, "crisis.view")) return <AccessDenied permission="crisis.view" role={user.role} />;
  if (!UUID.test(id)) notFound();
  const [ev] = await db.select().from(crisisEvents).where(and(eq(crisisEvents.id, id), eq(crisisEvents.missionId, user.missionId!))).limit(1);
  if (!ev) notFound();
  const rows = await db
    .select({ r: crisisResponses, name: citizenProfiles.fullName, ref: trips.reference, region: trips.id })
    .from(crisisResponses)
    .innerJoin(citizenProfiles, eq(citizenProfiles.userId, crisisResponses.userId))
    .leftJoin(trips, eq(trips.id, crisisResponses.tripId))
    .where(eq(crisisResponses.crisisEventId, id))
    .orderBy(asc(citizenProfiles.fullName));
  await audit(user, "crisis.view", "crisis_event", id, "Crisis responses viewed");
  const responded = rows.filter((x) => x.r.response);
  const pending = rows.filter((x) => !x.r.response);
  const rank = { need_help: 0, safe: 1, not_affected: 2 } as const;
  responded.sort((a, b) => rank[a.r.response!] - rank[b.r.response!]);
  const n = (k: string) => rows.filter((x) => x.r.response === k).length;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-sm"><Link href="/staff/crisis" className="underline">← Crisis checks</Link></p>
      <Flash notice={notice} />
      <PageHeader title={ev.title} eyebrow={`${ev.country}${ev.region ? ` · ${ev.region}` : ""}`} description={`Sent ${fmtDateTime(ev.sentAt, mission?.timezone)} · ${ev.status === "active" ? "Active" : `Closed ${fmtDateTime(ev.closedAt, mission?.timezone)}`} · delivery simulated`} actions={ev.status === "active" && can(user.role, "crisis.manage") ? <ConfirmDialog triggerLabel="Close this check" title="Close this wellbeing check?" description="Citizens will no longer be able to respond. Any locations shared for this request will be permanently removed. Responses are kept." confirmLabel="Close check" confirmVariant="danger" action={closeCrisis.bind(null, id)} /> : undefined} />
      <Card className="mb-6"><p className="text-sm font-medium text-navy-600">Message sent to citizens</p><p className="whitespace-pre-line text-navy-900">{ev.message}</p><p className="mt-2 text-xs text-navy-600">Location sharing was {ev.requestLocation ? "offered (optional, per request)" : "not offered"}.</p></Card>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Asked" value={rows.length} />
        <Stat label="I'm safe" value={n("safe")} />
        <Stat label="I need help" value={n("need_help")} tone={n("need_help") ? "red" : "neutral"} />
        <Stat label="Not in affected area" value={n("not_affected")} />
        <Stat label="Haven't responded" value={pending.length} hint="Not a concern signal" />
      </div>

      <SectionTitle>Responses ({responded.length})</SectionTitle>
      {responded.length === 0 ? <p className="mb-6 text-navy-700">No responses yet.</p> : (
        <div className={`${tableCls.wrap} mb-8`}>
          <table className={tableCls.table}>
            <caption className="sr-only">Citizens who responded, people asking for help first</caption>
            <thead><tr>{["Citizen", "Trip", "Response", "Note", "Shared location (by consent)", "Responded"].map((h) => <th key={h} scope="col" className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {responded.map(({ r, name, ref }) => (
                <tr key={r.id} className={r.response === "need_help" ? "bg-red-50/70" : ""}>
                  <td className={`${tableCls.td} font-semibold`}>{name}</td>
                  <td className={`${tableCls.td} font-mono text-xs`}>{ref}</td>
                  <td className={tableCls.td}><Badge tone={CRISIS_ANSWER[r.response!].tone}>{CRISIS_ANSWER[r.response!].label}</Badge></td>
                  <td className={tableCls.td}>{r.note ?? "—"}</td>
                  <td className={tableCls.td}>{r.locationText ?? (r.locationRevokedAt ? <span className="text-navy-500">Withdrawn / purged</span> : <span className="text-navy-500">Not shared</span>)}</td>
                  <td className={tableCls.td}>{fmtDateTime(r.respondedAt, mission?.timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle>Haven&apos;t responded ({pending.length})</SectionTitle>
      <Notice tone="warning" className="mb-3" title="A non-response is not evidence that someone is missing or injured">People may have no signal, be asleep, be busy, or simply prefer not to reply. Do not treat this list as a list of people at risk. Use it only to decide whether to send a gentle follow-up.</Notice>
      {pending.length === 0 ? <p className="text-navy-700">Everyone asked has responded.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pending.map(({ r, name, ref }) => <li key={r.id} className="rounded-xl border border-navy-100 bg-white p-3 text-sm"><span className="font-semibold">{name}</span> <span className="font-mono text-xs text-navy-600">{ref}</span></li>)}</ul>
      )}
    </div>
  );
}
