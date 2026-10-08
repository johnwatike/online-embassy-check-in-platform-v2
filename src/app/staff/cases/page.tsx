import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, like, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assistanceCases, citizenProfiles, users, type CaseStatus, type Priority } from "@/db/schema";
import { AccessDenied, MissionScopeNote } from "@/components/staff-bits";
import { Badge, Card, EmptyState, PageHeader, tableCls, btn } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CASE_CATEGORIES, CASE_STATUS, PRIORITY, can } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { alias } from "drizzle-orm/sqlite-core";

export const metadata: Metadata = { title: "Assistance cases" };

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; priority?: string; open?: string; mine?: string }> }) {
  const sp = await searchParams;
  const { user, mission } = await requireStaff();
  if (!can(user.role, "cases.manage")) return <AccessDenied permission="cases.manage" role={user.role} />;
  const assignee = alias(users, "assignee");
  const conds: (SQL | undefined)[] = [eq(assistanceCases.missionId, user.missionId!)];
  if (sp.open === "1") conds.push(ne(assistanceCases.status, "resolved"));
  if (sp.status && sp.status in CASE_STATUS) conds.push(eq(assistanceCases.status, sp.status as CaseStatus));
  if (sp.priority && sp.priority in PRIORITY) conds.push(eq(assistanceCases.priority, sp.priority as Priority));
  if (sp.mine === "1") conds.push(eq(assistanceCases.assignedToId, user.id));
  if (sp.q) conds.push(or(like(assistanceCases.reference, `%${sp.q}%`), like(citizenProfiles.fullName, `%${sp.q}%`)));
  const rows = await db
    .select({ c: assistanceCases, name: citizenProfiles.fullName, assignee: assignee.displayName })
    .from(assistanceCases)
    .innerJoin(citizenProfiles, eq(citizenProfiles.userId, assistanceCases.userId))
    .leftJoin(assignee, eq(assignee.id, assistanceCases.assignedToId))
    .where(and(...conds))
    .orderBy(desc(assistanceCases.createdAt));
  // Resolved last, then by priority, then oldest first so nothing is missed.
  rows.sort((a, b) => Number(a.c.status === "resolved") - Number(b.c.status === "resolved") || PRIORITY[a.c.priority].rank - PRIORITY[b.c.priority].rank || a.c.createdAt.getTime() - b.c.createdAt.getTime());
  const sel = "min-h-10 w-full rounded-lg border border-navy-300 bg-white px-2 text-sm";
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Assistance cases" description="Review requests, prioritise urgent cases and track progress. Sorted by priority, then oldest first." />
      <MissionScopeNote name={mission?.name ?? null} />
      <Card className="mb-5 p-4 sm:p-4">
        <form method="get" role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><label htmlFor="q" className="mb-1 block text-xs font-semibold">Reference or name</label><input id="q" name="q" defaultValue={sp.q} className={sel} /></div>
          <div><label htmlFor="status" className="mb-1 block text-xs font-semibold">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className={sel}><option value="">All</option>{Object.entries(CASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label htmlFor="priority" className="mb-1 block text-xs font-semibold">Priority</label><select id="priority" name="priority" defaultValue={sp.priority ?? ""} className={sel}><option value="">All</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="flex items-end gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} className="size-4 accent-teal-700" />Open only</label><label className="flex items-center gap-2"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} className="size-4 accent-teal-700" />Assigned to me</label></div>
          <div className="flex items-end gap-2"><button className={btn("primary", "sm")}>Apply</button><Link href="/staff/cases" className={btn("ghost", "sm")}>Clear</Link></div>
        </form>
      </Card>
      {rows.length === 0 ? <EmptyState title="No cases match" icon="✉">Try clearing a filter.</EmptyState> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Assistance cases</caption>
            <thead><tr>{["Priority", "Reference", "Citizen", "Category", "Status", "Assigned to", "Submitted"].map((h) => <th key={h} scope="col" className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ c, name, assignee: a }) => (
                <tr key={c.id} className={c.priority === "urgent" && c.status !== "resolved" ? "bg-red-50/60" : "hover:bg-navy-50/60"}>
                  <td className={tableCls.td}><Badge tone={PRIORITY[c.priority].tone}>{PRIORITY[c.priority].label}</Badge>{c.citizenUrgency === "urgent" && c.priority !== "urgent" && <p className="mt-1 text-xs text-red-800">Citizen marked urgent</p>}</td>
                  <td className={tableCls.td}><Link className="font-mono text-xs font-semibold underline" href={`/staff/cases/${c.id}`}>{c.reference}</Link></td>
                  <td className={tableCls.td}>{name}</td>
                  <td className={tableCls.td}>{CASE_CATEGORIES[c.category].label}</td>
                  <td className={tableCls.td}><Badge tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</Badge></td>
                  <td className={tableCls.td}>{a ?? <span className="text-navy-500">Unassigned</span>}</td>
                  <td className={tableCls.td}>{fmtDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
