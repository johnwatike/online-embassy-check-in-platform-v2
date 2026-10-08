import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { missionJurisdictions } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, Pagination, tableCls, btn } from "@/components/ui";
import { TripStatusBadge, WellbeingBadge } from "@/components/citizen-bits";
import { AccessDenied, MissionScopeNote } from "@/components/staff-bits";
import { requireStaff } from "@/lib/auth";
import { PURPOSES, TRIP_STATUS, WELLBEING, can } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { staffRegistrations } from "@/lib/staff-data";

export const metadata: Metadata = { title: "Citizen registrations" };

type SP = { q?: string; country?: string; region?: string; status?: string; wellbeing?: string; from?: string; to?: string; sort?: string; dir?: string; page?: string };

export default async function Registrations({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { user, mission } = await requireStaff();
  if (!can(user.role, "records.view")) return <AccessDenied permission="records.view" role={user.role} />;
  const juris = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, user.missionId!));
  const countries = [...new Set(juris.map((j) => j.country))].sort();
  const { rows, total, page, pages } = await staffRegistrations(user, { ...sp, page: Number(sp.page) || 1 });
  const keep: Record<string, string | undefined> = { q: sp.q, country: sp.country, region: sp.region, status: sp.status, wellbeing: sp.wellbeing, from: sp.from, to: sp.to, sort: sp.sort, dir: sp.dir };
  const sortLink = (col: string, label: string) => {
    const dir = (sp.sort ?? "arrival") === col && sp.dir !== "asc" ? "asc" : "desc";
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, sort: col, dir })) if (v) p.set(k, v);
    const active = (sp.sort ?? "arrival") === col;
    return <Link href={`/staff/registrations?${p.toString()}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline" aria-label={`Sort by ${label}`}>{label}{active && <span aria-hidden>{sp.dir === "asc" ? "▲" : "▼"}</span>}</Link>;
  };
  const sel = "min-h-10 w-full rounded-lg border border-navy-300 bg-white px-2 text-sm";
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Citizen registrations" description="Search and manage registrations within your jurisdiction. Opening a record is logged." />
      <MissionScopeNote name={mission?.name ?? null} />
      <Card className="mb-5 p-4 sm:p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
          <div><label htmlFor="q" className="mb-1 block text-xs font-semibold">Name or reference</label><input id="q" name="q" defaultValue={sp.q} className={sel} /></div>
          <div><label htmlFor="country" className="mb-1 block text-xs font-semibold">Destination country</label><select id="country" name="country" defaultValue={sp.country ?? ""} className={sel}><option value="">All</option>{countries.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="region" className="mb-1 block text-xs font-semibold">Region or city</label><input id="region" name="region" defaultValue={sp.region} className={sel} /></div>
          <div><label htmlFor="status" className="mb-1 block text-xs font-semibold">Registration status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className={sel}><option value="">All</option>{Object.entries(TRIP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label htmlFor="wellbeing" className="mb-1 block text-xs font-semibold">Latest wellbeing status</label><select id="wellbeing" name="wellbeing" defaultValue={sp.wellbeing ?? ""} className={sel}><option value="">All</option>{Object.entries(WELLBEING).map(([k, v]) => <option key={k} value={k}>{v.short}</option>)}<option value="none">No update yet</option></select></div>
          <div><label htmlFor="from" className="mb-1 block text-xs font-semibold">Travelling on or after</label><input id="from" name="from" type="date" defaultValue={sp.from} className={sel} /></div>
          <div><label htmlFor="to" className="mb-1 block text-xs font-semibold">Arriving on or before</label><input id="to" name="to" type="date" defaultValue={sp.to} className={sel} /></div>
          <div className="flex items-end gap-2"><button className={btn("primary", "sm")}>Apply filters</button><Link href="/staff/registrations" className={btn("ghost", "sm")}>Clear</Link></div>
        </form>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No registrations match" icon="🔍">Try removing a filter. Records outside your jurisdiction are never shown.</EmptyState>
      ) : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Citizen registrations in your jurisdiction</caption>
            <thead><tr>
              <th scope="col" className={tableCls.th}>{sortLink("name", "Citizen")}</th>
              <th scope="col" className={tableCls.th}>{sortLink("ref", "Reference")}</th>
              <th scope="col" className={tableCls.th}>{sortLink("destination", "Destination")}</th>
              <th scope="col" className={tableCls.th}>{sortLink("arrival", "Arrival")}</th>
              <th scope="col" className={tableCls.th}>{sortLink("departure", "Departure")}</th>
              <th scope="col" className={tableCls.th}>{sortLink("status", "Registration")}</th>
              <th scope="col" className={tableCls.th}>{sortLink("wellbeing", "Wellbeing")}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.tripId}-${r.country}-${r.arrival}`} className="hover:bg-navy-50/60">
                  <td className={tableCls.td}><Link className="font-semibold text-navy-950 underline decoration-navy-300 underline-offset-4 hover:decoration-teal-700" href={`/staff/registrations/${r.tripId}`}>{r.name}</Link><p className="text-xs text-navy-600">{PURPOSES[r.purpose] ?? r.purpose}</p></td>
                  <td className={`${tableCls.td} font-mono text-xs`}>{r.reference}</td>
                  <td className={tableCls.td}>{r.country}<p className="text-xs text-navy-600">{r.region}</p></td>
                  <td className={tableCls.td}>{fmtDate(r.arrival)}</td>
                  <td className={tableCls.td}>{r.departure ? fmtDate(r.departure) : <span className="text-navy-500">not set</span>}</td>
                  <td className={tableCls.td}><TripStatusBadge status={r.status} /></td>
                  <td className={tableCls.td}>{r.wellbeing ? <><WellbeingBadge status={r.wellbeing} /><p className="mt-0.5 text-xs text-navy-600">{fmtDateTime(r.wellbeingAt)}</p></> : <Badge>No update</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/staff/registrations" params={keep} page={page} pages={pages} total={total} />
      <p className="mt-3 text-xs text-navy-600">A missing wellbeing update is not an indicator of risk. Use it only to decide whom to remind.</p>
    </div>
  );
}
