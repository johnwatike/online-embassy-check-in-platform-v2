import type { Metadata } from "next";
import { PrintButton } from "@/components/print-button";
import { tripTitle } from "@/components/citizen-bits";
import { Card, DemoNote, EmptyState, Notice, PageHeader, btn } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { buildCardData } from "@/lib/card";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { FALLBACK_CONTACT } from "@/lib/constants";

export const metadata: Metadata = { title: "Emergency contact card" };

export default async function CardPage({ searchParams }: { searchParams: Promise<{ trip?: string; contact?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireCitizen();
  const d = await buildCardData(user.id, sp.trip, sp.contact);
  const qs = new URLSearchParams();
  if (d.trip) qs.set("trip", d.trip.id);
  if (sp.contact) qs.set("contact", sp.contact);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print">
        <PageHeader title="Emergency contact card" description="A printable card with your embassy's published contact details. Download it to keep on your phone or in your luggage for offline use." />
        <form method="get" className="mb-5 grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="trip" className="mb-1 block text-sm font-semibold">Trip</label>
            <select id="trip" name="trip" defaultValue={d.trip?.id ?? ""} className="min-h-11 w-full rounded-lg border border-navy-300 bg-white px-3">
              {d.open.length === 0 && <option value="">No current trip</option>}
              {d.open.map((t) => <option key={t.id} value={t.id}>{tripTitle(t)} · {t.reference}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="contact" className="mb-1 block text-sm font-semibold">Emergency contact to print</label>
            <select id="contact" name="contact" defaultValue={sp.contact ?? d.contact?.id ?? "none"} className="min-h-11 w-full rounded-lg border border-navy-300 bg-white px-3">
              <option value="none">None</option>
              {d.contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.relationship})</option>)}
            </select>
          </div>
          <button className={btn("primary")}>Update card</button>
        </form>
        <div className="mb-5 flex flex-wrap gap-2">
          <PrintButton label="Print card" />
          <a className={btn("teal")} href={`/api/card?${qs.toString()}`} download>Download for offline use (HTML)</a>
        </div>
        <Notice tone="info" className="mb-5">Only details published by the mission are included. Placeholder values in this demo are marked. Your status and location are not on the card.</Notice>
      </div>

      {!d.mission && !d.trip ? (
        <EmptyState title="Register a trip to create your card" icon="▤">Your card shows the embassy responsible for your destination and your trip reference.</EmptyState>
      ) : (
        <Card className="print-card border-2 border-navy-900">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Embassy Connect · Emergency contact card</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-navy-950">{d.name}</h2>
          <p className="text-sm text-navy-700">Kenyan citizen <DemoNote>Demo card – sample data</DemoNote></p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm font-medium text-navy-600">Trip reference</dt><dd className="font-mono text-lg font-bold">{d.trip?.reference ?? "—"}</dd><dd className="text-sm">{d.trip ? `${tripTitle(d.trip)} · until ${d.trip.endsOn ? fmtDate(d.trip.endsOn) : "date not set"}` : ""}</dd></div>
            <div><dt className="text-sm font-medium text-navy-600">Responsible embassy</dt><dd className="font-semibold">{d.mission?.name ?? "No mission covers this destination"}</dd><dd className="text-sm">{d.mission?.address}</dd></div>
            <div><dt className="text-sm font-medium text-navy-600">Embassy emergency line</dt><dd className="text-xl font-bold">{d.mission?.emergencyPhone ?? FALLBACK_CONTACT.phone}</dd><dd><DemoNote>Placeholder – not a working line</DemoNote></dd></div>
            <div><dt className="text-sm font-medium text-navy-600">Embassy general contact</dt><dd>{d.mission?.phone ?? "—"}</dd><dd className="break-all text-sm">{d.mission?.email}</dd></div>
            <div><dt className="text-sm font-medium text-navy-600">Local emergency services{d.dest ? ` (${d.dest.country})` : ""}</dt><dd className="text-lg font-semibold">{d.local ?? "Check official local sources"}</dd><dd className="text-xs text-navy-600">Public reference – confirm locally</dd></div>
            <div><dt className="text-sm font-medium text-navy-600">My emergency contact</dt>{d.contact ? <><dd className="font-semibold">{d.contact.name} ({d.contact.relationship})</dd><dd>{d.contact.phone}</dd></> : <dd>Not included</dd>}</div>
          </dl>
          <p className="mt-5 border-t border-navy-200 pt-3 text-xs text-navy-700">Last updated {fmtDateTime(d.updatedAt)} · Registration does not replace visas, immigration registration or local emergency services. Contact details are demo placeholders and are not verified.</p>
        </Card>
      )}
    </div>
  );
}
