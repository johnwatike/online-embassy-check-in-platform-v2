import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { crisisEvents, crisisResponses } from "@/db/schema";
import { AccessDenied, MissionScopeNote } from "@/components/staff-bits";
import { Badge, ButtonLink, EmptyState, Flash, Notice, PageHeader, tableCls } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Crisis wellbeing checks" };

export default async function CrisisList({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { user, mission } = await requireStaff();
  if (!can(user.role, "crisis.view")) return <AccessDenied permission="crisis.view" role={user.role} />;
  const events = await db.select().from(crisisEvents).where(eq(crisisEvents.missionId, user.missionId!)).orderBy(desc(crisisEvents.sentAt));
  const counts = new Map<string, { responded: number; help: number }>();
  for (const e of events) {
    const rs = await db.select({ r: crisisResponses.response }).from(crisisResponses).where(eq(crisisResponses.crisisEventId, e.id));
    counts.set(e.id, { responded: rs.filter((x) => x.r).length, help: rs.filter((x) => x.r === "need_help").length });
  }
  return (
    <div className="mx-auto max-w-6xl">
      <Flash notice={notice} />
      <PageHeader title="Crisis wellbeing checks" description="Send a targeted check-in to citizens in an affected area and see who has responded." actions={can(user.role, "crisis.manage") ? <ButtonLink href="/staff/crisis/new" variant="danger">New wellbeing check</ButtonLink> : undefined} />
      <MissionScopeNote name={mission?.name ?? null} />
      {!can(user.role, "crisis.manage") && <Notice tone="info" className="mb-4">Only mission administrators can create and send wellbeing checks. You can view responses.</Notice>}
      {events.length === 0 ? <EmptyState title="No crisis events" icon="⚠">Wellbeing checks you send will appear here.</EmptyState> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Crisis events</caption>
            <thead><tr>{["Event", "Area", "Sent", "Responded", "Asked for help", "Status"].map((h) => <th key={h} scope="col" className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {events.map((e) => {
                const c = counts.get(e.id)!;
                return (
                  <tr key={e.id}>
                    <td className={tableCls.td}><Link className="font-semibold underline" href={`/staff/crisis/${e.id}`}>{e.title}</Link></td>
                    <td className={tableCls.td}>{e.country}{e.region ? `, ${e.region}` : ""}</td>
                    <td className={tableCls.td}>{fmtDateTime(e.sentAt, mission?.timezone)}</td>
                    <td className={tableCls.td}>{c.responded} of {e.targetedCount}</td>
                    <td className={tableCls.td}>{c.help ? <Badge tone="red">{c.help}</Badge> : "0"}</td>
                    <td className={tableCls.td}><Badge tone={e.status === "active" ? "amber" : "neutral"}>{e.status === "active" ? "Active" : "Closed"}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
