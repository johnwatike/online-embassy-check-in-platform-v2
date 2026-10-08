import type { Metadata } from "next";
import { CheckinMap } from "@/components/checkin-map";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, BarList, Card, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { WELLBEING, can } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { staffMapPoints } from "@/lib/staff-data";

export const metadata: Metadata = { title: "Check-in map" };
export const dynamic = "force-dynamic";

export default async function StaffMapPage() {
  const { user, mission } = await requireStaff();
  if (!can(user.role, "records.view") || !mission) return <AccessDenied permission="records.view" role={user.role} />;
  const points = await staffMapPoints(user);

  const byCountry = Object.entries(points.reduce<Record<string, number>>((m, p) => ((m[p.country] = (m[p.country] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const count = (w: string) => points.filter((p) => p.wellbeing === w).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={mission.name}
        title="Check-in map"
        description="Where citizens registered to this mission are right now — at their shared lodging location when given, otherwise at the place or capital of their destination."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="green">● Safe · {count("safe")}</Badge>
        <Badge tone="red">● Needs assistance · {count("need_assistance")}</Badge>
        <Badge tone="gold">● Plans changed · {count("plans_changed")}</Badge>
        <Badge tone="navy">● No update / upcoming · {points.length - count("safe") - count("need_assistance") - count("plans_changed")}</Badge>
      </div>
      <CheckinMap points={points} />
      <p className="mt-2 text-xs text-navy-600">Map data © OpenStreetMap contributors. Hollow rings are approximate (destination city or capital). Citizens choose what to share; no continuous tracking.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Check-ins by country</SectionTitle>
          <BarList items={byCountry.map(([label, value]) => ({ label, value }))} />
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle>Locations ({points.length})</SectionTitle>
          {points.length === 0 ? (
            <p className="text-sm text-navy-600">No current or upcoming registrations for this mission yet.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-navy-100 overflow-y-auto pr-1">
              {points.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-semibold text-navy-950">{p.citizen} <span className="font-normal text-navy-600">· {p.ref}</span></p>
                    <p className="text-sm text-navy-700">
                      {p.place}
                      {p.approx && <span className="text-navy-500"> (approximate)</span>} · {p.lat}, {p.lng}
                    </p>
                    {p.lodging && <p className="text-xs text-navy-600">🏨 {p.lodging}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-navy-700">
                    {fmtDate(p.arrival)} → {p.departure ? fmtDate(p.departure) : "open"}
                    {p.wellbeing ? <Badge tone={WELLBEING[p.wellbeing as keyof typeof WELLBEING]?.tone ?? "neutral"}>{WELLBEING[p.wellbeing as keyof typeof WELLBEING]?.short ?? p.wellbeing}</Badge> : <Badge tone={p.status === "active" ? "navy" : "neutral"}>{p.status === "active" ? "No update" : "Upcoming"}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Notice tone="info" className="mt-6" title="Reading this map">
        A dot uses the citizen&apos;s own lodging coordinates when they shared them; otherwise the destination city, or the capital as a last resort (marked approximate). Location detail is always optional and is never shared beyond this mission&apos; authorised staff.
      </Notice>
    </div>
  );
}
