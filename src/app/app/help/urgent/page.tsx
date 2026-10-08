import type { Metadata } from "next";
import { MissionContact } from "@/components/mission-card";
import { Badge, ButtonLink, Card, DemoNote, Notice, PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { EMERGENCY_DISCLAIMER, FALLBACK_CONTACT, LOCAL_EMERGENCY } from "@/lib/constants";
import { currentDestination, getContacts, getUserTrips } from "@/lib/data";

export const metadata: Metadata = { title: "Get urgent help" };

export default async function UrgentHelp() {
  const { user } = await requireCitizen();
  const [trips, contacts] = await Promise.all([getUserTrips(user.id), getContacts(user.id)]);
  const open = trips.filter((t) => t.status === "active" || t.status === "planned");
  const places = open.flatMap((t) => {
    const d = currentDestination(t);
    return d ? [d] : [];
  });
  const unique = places.filter((d, i) => places.findIndex((x) => x.country === d.country) === i);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Get urgent help" eyebrow="Emergency support" />
      <div className="rounded-2xl border-2 border-red-700 bg-red-50 p-5">
        <h2 className="text-2xl font-bold text-red-950">1. If there is immediate danger, call local emergency services first</h2>
        <p className="mt-1 text-lg text-red-950">{EMERGENCY_DISCLAIMER}</p>
        {unique.length === 0 ? (
          <p className="mt-3 text-red-950">You have no registered trips. Look up the emergency number for the country you are in — the demo only lists a few countries.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {unique.map((d) => (
              <li key={d.country} className="rounded-xl bg-white p-4">
                <p className="text-sm font-medium text-navy-600">Local emergency services in {d.country}</p>
                <p className="text-2xl font-bold text-navy-950">{LOCAL_EMERGENCY[d.country] ?? "Not listed in this demo"}</p>
                <p className="text-xs text-navy-600">Public reference. Not verified by this demo – confirm locally.</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-2xl font-semibold text-navy-950">2. Embassy emergency contact</h2>
      <div className="space-y-4">
        {unique.length === 0 && <MissionPlaceholder />}
        {unique.map((d) =>
          d.mission ? <MissionContact key={d.country} mission={d.mission} destinationCountry={d.country} /> : (
            <Notice key={d.country} tone="warning" title={`No mission covers ${d.country} in this demo`}>
              Use the fallback line: {FALLBACK_CONTACT.name} – {FALLBACK_CONTACT.phone}<DemoNote />. {FALLBACK_CONTACT.email}
            </Notice>
          ),
        )}
      </div>

      <h2 className="mb-3 mt-8 text-2xl font-semibold text-navy-950">3. Send an online request</h2>
      <Card>
        <Notice tone="warning" title="Submitting a request does not guarantee an immediate response">Online requests may not be monitored continuously. Staff review them in priority order. We cannot promise evacuation, financial support or a specific response time.</Notice>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/app/help/new?category=medical&urgency=urgent" variant="danger">Medical emergency</ButtonLink>
          <ButtonLink href="/app/help/new?category=detention&urgency=urgent" variant="danger">Arrest or detention</ButtonLink>
          <ButtonLink href="/app/help/new?category=crime&urgency=urgent" variant="danger">Crime or personal safety</ButtonLink>
          <ButtonLink href="/app/help" variant="outline">Other kinds of help</ButtonLink>
        </div>
      </Card>

      {contacts.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold text-navy-950">Your emergency contacts</h2>
          <ul className="mt-2 space-y-1 text-navy-800">{contacts.map((c) => <li key={c.id}>{c.name} ({c.relationship}) – {c.phone}</li>)}</ul>
          <p className="mt-2 text-sm text-navy-600">We never contact them or share your status or location automatically. <Badge>You decide</Badge></p>
        </Card>
      )}
    </div>
  );
}

function MissionPlaceholder() {
  return (
    <Notice tone="info" title="Register a trip to see your embassy here">
      Fallback line: {FALLBACK_CONTACT.name} – {FALLBACK_CONTACT.phone}<DemoNote />
    </Notice>
  );
}
