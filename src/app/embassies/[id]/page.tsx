import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MissionContact } from "@/components/mission-card";
import { PublicFooter, PublicHeader } from "@/components/public";
import { Badge, ButtonLink, Card, Notice, SectionTitle } from "@/components/ui";
import { SEVERITY } from "@/lib/constants";
import { activeAlertsForMission, getMissionDetail } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  await ensureSeeded();
  const m = await getMissionDetail(id);
  return { title: m?.name ?? "Embassy" };
}

export default async function EmbassyDetail({ params }: { params: Promise<{ id: string }> }) {
  await ensureSeeded();
  const { id } = await params;
  const m = await getMissionDetail(id);
  if (!m) notFound();
  const alerts = await activeAlertsForMission(m.id);
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <p className="mb-2 text-sm"><Link href="/embassies" className="underline">← All missions</Link></p>
        <h1 className="font-serif text-4xl font-semibold text-navy-950">{m.name}</h1>
        <p className="mt-1 text-navy-700">{m.city}, {m.country}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            <MissionContact mission={m} showLink={false} />
            <Card>
              <SectionTitle>Services and what to bring</SectionTitle>
              <ul className="space-y-4">
                {m.services.map((s) => (
                  <li key={s.id}>
                    <h3 className="font-semibold text-navy-950">{s.name} <span className="text-sm font-normal text-navy-600">· about {s.durationMin} min</span></h3>
                    <p className="text-sm text-navy-700">{s.description}</p>
                    {s.documents.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm text-navy-800">{s.documents.map((d) => <li key={d}>{d}</li>)}</ul>}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-navy-600">Services depend on this mission&apos;s real capabilities. Always check requirements before you travel to an appointment.</p>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <SectionTitle>Countries and regions served</SectionTitle>
              <ul className="space-y-2">
                {m.jurisdictions.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 pb-2 last:border-0">
                    <span className="font-medium text-navy-900">{j.country}{j.region ? ` – ${j.region}` : ""}</span>
                    {j.country !== m.country && <Badge tone="teal">Served from {m.city}</Badge>}
                    {j.country === m.country && !j.region && <Badge tone="navy">Host country</Badge>}
                    {j.region && <Badge>Region</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <SectionTitle>Current verified notices</SectionTitle>
              {alerts.length === 0 ? <p className="text-sm text-navy-600">No active notices from this mission.</p> : (
                <ul className="space-y-3">
                  {alerts.map((a) => (
                    <li key={a.id} className="text-sm">
                      <Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge>
                      <p className="mt-1 font-medium text-navy-950">{a.title}</p>
                      <p className="text-navy-600">Published {fmtDateTime(a.publishedAt, m.timezone)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Notice tone="info" title="Registering your travel">It helps this mission contact you and understand your situation if you ask for help. It does not replace visas, immigration registration or local emergency services.</Notice>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/app/trips/new" variant="teal">Check in for a trip</ButtonLink>
              <ButtonLink href={`/app/appointments/book?mission=${m.id}`} variant="outline">Book an appointment</ButtonLink>
            </div>
            <p className="text-xs text-navy-600">Sample verification date {fmtDate(m.lastVerifiedAt)}. The Ministry must confirm details before launch.</p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
