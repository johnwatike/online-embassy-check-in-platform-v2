import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { createSlots, deleteSlot, markAttendance, staffCancelAppointment } from "@/app/actions/staff";
import { db } from "@/db";
import { appointments, citizenProfiles } from "@/db/schema";
import { ActionButton, ActionForm, SelectField, SubmitButton, TextField } from "@/components/form";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, cx, tableCls } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { APPT_STATUS, can } from "@/lib/constants";
import { addDaysDate, dayKey, fmtDayLong, fmtTime, todayStr, zonedToUtc } from "@/lib/format";

export const metadata: Metadata = { title: "Appointments" };

export default async function StaffAppointments({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; date?: string; status?: string }> }) {
  const sp = await searchParams;
  const { user, mission } = await requireStaff();
  if (!can(user.role, "appointments.manage") || !mission) return <AccessDenied permission="appointments.manage" role={user.role} />;
  const tz = mission.timezone;
  const view = sp.view === "calendar" ? "calendar" : "list";
  const today = todayStr();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const from = view === "calendar" ? zonedToUtc(`${month}-01`, "00:00", tz) : addDaysDate(-1);
  const to = view === "calendar" ? zonedToUtc(`${next}-01`, "00:00", tz) : addDaysDate(45);

  const rows = await db
    .select({ a: appointments, name: citizenProfiles.fullName })
    .from(appointments)
    .leftJoin(citizenProfiles, eq(citizenProfiles.userId, appointments.userId))
    .where(and(eq(appointments.missionId, mission.id), gte(appointments.startsAt, from), lt(appointments.startsAt, to), ne(appointments.status, "rescheduled")))
    .orderBy(asc(appointments.startsAt));
  const statusFilter = sp.status && sp.status in APPT_STATUS ? sp.status : "";
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : "";
  let shown = rows.filter((r) => !statusFilter || r.a.status === statusFilter);
  if (view === "calendar" && selectedDate) shown = shown.filter((r) => dayKey(r.a.startsAt, tz) === selectedDate);

  const byDay = new Map<string, { booked: number; open: number }>();
  for (const r of rows) {
    const k = dayKey(r.a.startsAt, tz);
    const v = byDay.get(k) ?? { booked: 0, open: 0 };
    if (r.a.status === "booked" || r.a.status === "attended" || r.a.status === "no_show") v.booked++;
    if (r.a.status === "available") v.open++;
    byDay.set(k, v);
  }
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const qs = (o: Record<string, string>) => `/staff/appointments?${new URLSearchParams({ view, ...(view === "calendar" ? { month } : {}), ...o }).toString()}`;
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Appointments" description={`Manage slots, bookings and attendance. All times are in ${tz} (${mission.city} local time).`} />
      <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="View">
        <Link role="tab" aria-selected={view === "list"} href="/staff/appointments?view=list" className={cx("rounded-lg border px-4 py-2 text-sm font-semibold", view === "list" ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white")}>List view</Link>
        <Link role="tab" aria-selected={view === "calendar"} href="/staff/appointments?view=calendar" className={cx("rounded-lg border px-4 py-2 text-sm font-semibold", view === "calendar" ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white")}>Calendar view</Link>
        <form method="get" className="ml-auto flex items-center gap-2 text-sm">
          <input type="hidden" name="view" value={view} />
          {view === "calendar" && <input type="hidden" name="month" value={month} />}
          <label htmlFor="status" className="font-semibold">Status</label>
          <select id="status" name="status" defaultValue={statusFilter} className="min-h-10 rounded-lg border border-navy-300 bg-white px-2"><option value="">All</option>{Object.entries(APPT_STATUS).filter(([k]) => k !== "rescheduled").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <button className="min-h-10 rounded-lg border border-navy-300 bg-white px-3 font-semibold">Filter</button>
        </form>
      </div>

      {view === "calendar" && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <Link className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-semibold" href={`/staff/appointments?view=calendar&month=${prev}`} aria-label="Previous month">← {prev}</Link>
            <h2 className="font-serif text-xl font-semibold">{monthLabel}</h2>
            <Link className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-semibold" href={`/staff/appointments?view=calendar&month=${next}`} aria-label="Next month">{next} →</Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-navy-600" aria-hidden>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = `${month}-${String(d).padStart(2, "0")}`;
              const v = byDay.get(key);
              return (
                <Link key={i} href={`/staff/appointments?view=calendar&month=${month}&date=${key}`} aria-label={`${key}: ${v?.booked ?? 0} booked, ${v?.open ?? 0} open`} aria-current={key === selectedDate ? "date" : undefined} className={cx("flex min-h-16 flex-col rounded-lg border p-1.5 text-left text-xs hover:border-teal-600", key === selectedDate ? "border-teal-700 bg-teal-50" : "border-navy-100 bg-white", key === today && "ring-2 ring-gold-400")}>
                  <span className="font-semibold text-navy-950">{d}</span>
                  {v?.booked ? <span className="text-navy-800">{v.booked} booked</span> : null}
                  {v?.open ? <span className="text-teal-800">{v.open} open</span> : null}
                </Link>
              );
            })}
          </div>
          {selectedDate && <p className="mt-3 text-sm">Showing {selectedDate}. <Link className="underline" href={`/staff/appointments?view=calendar&month=${month}`}>Show whole month</Link></p>}
        </Card>
      )}

      <SectionTitle>{view === "calendar" ? (selectedDate ? `Appointments on ${selectedDate}` : `Appointments in ${monthLabel}`) : "Upcoming slots and bookings (next 45 days)"}</SectionTitle>
      {shown.length === 0 ? <EmptyState title="No appointments in this view" icon="📅">Add slots below, or change the filter.</EmptyState> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Appointment slots and bookings</caption>
            <thead><tr>{["When", "Service", "Citizen", "Reference", "Status", "Actions"].map((h) => <th key={h} scope="col" className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(({ a, name }) => (
                <tr key={a.id}>
                  <td className={tableCls.td}><span className="font-semibold">{fmtDayLong(a.startsAt, tz).replace(/^\w+, /, "")}</span><br />{fmtTime(a.startsAt, tz)}</td>
                  <td className={tableCls.td}>{a.serviceName}<p className="text-xs text-navy-600">{a.durationMin} min</p></td>
                  <td className={tableCls.td}>{name ?? <span className="text-navy-500">—</span>}</td>
                  <td className={`${tableCls.td} font-mono text-xs`}>{a.reference ?? "—"}</td>
                  <td className={tableCls.td}><Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>{a.cancelledBy && <p className="text-xs text-navy-600">by {a.cancelledBy}</p>}</td>
                  <td className={tableCls.td}>
                    <div className="flex flex-wrap gap-1.5">
                      {a.status === "booked" && <>
                        <ActionButton action={markAttendance.bind(null, a.id, "attended")}>Attended</ActionButton>
                        <ActionButton action={markAttendance.bind(null, a.id, "no_show")}>Did not attend</ActionButton>
                        <ActionButton variant="ghost" action={staffCancelAppointment.bind(null, a.id)}>Cancel</ActionButton>
                      </>}
                      {a.status === "available" && <ActionButton variant="ghost" action={deleteSlot.bind(null, a.id)}>Remove slot</ActionButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="mt-8">
        <SectionTitle>Add available slots</SectionTitle>
        <ActionForm action={createSlots} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <SelectField label="Service" name="serviceId" required>{mission.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectField>
          <TextField label="Date" name="date" type="date" required min={today} />
          <TextField label={`Start time (${tz})`} name="time" type="time" required defaultValue="09:00" />
          <TextField label="Number of slots" name="count" type="number" min={1} max={12} defaultValue={3} required hint="Back to back" />
          <div className="sm:col-span-2 lg:col-span-5"><SubmitButton variant="teal" pendingLabel="Adding…">Add slots</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
