import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, like, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, missions, users } from "@/db/schema";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, Card, Notice, PageHeader, Pagination, SectionTitle, tableCls, btn } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { PERMISSIONS, ROLE_LABEL, can, type Permission } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { Role } from "@/db/schema";

export const metadata: Metadata = { title: "Roles and audit history" };
const PAGE = 20;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; area?: string; page?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireStaff();
  if (!can(user.role, "audit.view")) return <AccessDenied permission="audit.view" role={user.role} />;
  const page = Math.max(1, Number(sp.page) || 1);
  const conds: (SQL | undefined)[] = [];
  if (user.role === "mission_admin") conds.push(eq(auditEvents.missionId, user.missionId!));
  if (sp.q) conds.push(or(like(auditEvents.summary, `%${sp.q}%`), like(auditEvents.actorName, `%${sp.q}%`)));
  if (sp.area) conds.push(like(auditEvents.action, `${sp.area}.%`));
  const where = and(...conds);
  const [[{ c: total }], events, staff] = await Promise.all([
    db.select({ c: count() }).from(auditEvents).where(where),
    db.select().from(auditEvents).where(where).orderBy(desc(auditEvents.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ u: users, mission: missions.name }).from(users).leftJoin(missions, eq(missions.id, users.missionId)).where(and(ne(users.role, "citizen"), user.role === "mission_admin" ? eq(users.missionId, user.missionId!) : undefined)).orderBy(users.role, users.displayName),
  ]);
  const roles: Role[] = ["citizen", "consular_officer", "mission_admin", "platform_admin"];
  const areas = ["case", "registration", "alert", "crisis", "appointment", "mission", "session", "trip", "privacy"];
  const sel = "min-h-10 rounded-lg border border-navy-300 bg-white px-2 text-sm";
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader title="Roles and audit history" description="Who can do what, who has an account, and a log of record access, changes, assignments and communications." />
      <Notice tone="info" title="Demo role switching">Switching between personas on the sign-in page is for demonstration. In production, roles are assigned by administrators and staff authenticate with single sign-on and multi-factor authentication. Every action below is checked on the server.</Notice>

      <section aria-labelledby="matrix">
        <SectionTitle id="matrix">Permission matrix (least privilege)</SectionTitle>
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Permissions by role</caption>
            <thead><tr><th scope="col" className={tableCls.th}>Permission</th>{roles.map((r) => <th key={r} scope="col" className={tableCls.th}>{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p}>
                  <th scope="row" className={`${tableCls.td} font-medium`}>{PERMISSIONS[p].label}</th>
                  {roles.map((r) => <td key={r} className={tableCls.td}>{PERMISSIONS[p].roles.includes(r) ? <span aria-label="Allowed" className="font-bold text-teal-700">✓</span> : <span aria-label="Not allowed" className="text-navy-300">–</span>}</td>)}
                </tr>
              ))}
              <tr><th scope="row" className={`${tableCls.td} font-medium`}>Own trips, cases, appointments and profile</th>{roles.map((r) => <td key={r} className={tableCls.td}>{r === "citizen" ? <span aria-label="Allowed" className="font-bold text-teal-700">✓</span> : <span className="text-navy-300">–</span>}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-navy-600">Citizens only ever see their own records. Staff are limited to their mission&apos;s jurisdiction. Platform administrators do not have access to individual citizen records.</p>
      </section>

      <section aria-labelledby="accounts">
        <SectionTitle id="accounts">Staff accounts</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map(({ u, mission }) => <li key={u.id}><Card className="p-4 sm:p-4"><p className="font-semibold text-navy-950">{u.displayName}</p><p className="text-sm text-navy-700">{mission ?? "All missions"}</p><div className="mt-1"><Badge tone={u.role === "platform_admin" ? "gold" : u.role === "mission_admin" ? "navy" : "teal"}>{ROLE_LABEL[u.role]}</Badge></div></Card></li>)}
        </ul>
      </section>

      <section aria-labelledby="log">
        <SectionTitle id="log">Audit log</SectionTitle>
        <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
          <div><label htmlFor="q" className="mb-1 block text-xs font-semibold">Search summary or person</label><input id="q" name="q" defaultValue={sp.q} className={sel} /></div>
          <div><label htmlFor="area" className="mb-1 block text-xs font-semibold">Area</label><select id="area" name="area" defaultValue={sp.area ?? ""} className={sel}><option value="">All</option>{areas.map((a) => <option key={a}>{a}</option>)}</select></div>
          <button className={btn("primary", "sm")}>Filter</button><Link href="/staff/audit" className={btn("ghost", "sm")}>Clear</Link>
        </form>
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Audit events, newest first</caption>
            <thead><tr>{["Time (UTC)", "Who", "Action", "Summary"].map((h) => <th key={h} scope="col" className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {events.length === 0 && <tr><td className={tableCls.td} colSpan={4}>No events match.</td></tr>}
              {events.map((e) => (
                <tr key={e.id}>
                  <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDateTime(e.createdAt)}</td>
                  <td className={tableCls.td}>{e.actorName}<p className="text-xs text-navy-600">{e.actorRole.replace("_", " ")}</p></td>
                  <td className={`${tableCls.td} font-mono text-xs`}>{e.action}</td>
                  <td className={tableCls.td}>{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/staff/audit" params={{ q: sp.q, area: sp.area }} page={page} pages={Math.max(1, Math.ceil(total / PAGE))} total={total} />
        <p className="mt-2 text-xs text-navy-600">Audit summaries never contain case text, notes, locations or other sensitive content.</p>
      </section>
    </div>
  );
}
