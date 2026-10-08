import type { Metadata } from "next";
import Link from "next/link";
import { submitFeedback } from "@/app/actions/citizen";
import { ActionForm, RadioCards, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { MissionContact } from "@/components/mission-card";
import { ButtonLink, Card, Flash, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { FALLBACK_CONTACT } from "@/lib/constants";
import { currentDestination, getUserTrips, listMissionsWithJurisdictions } from "@/lib/data";
import type { Mission } from "@/lib/types";

export const metadata: Metadata = { title: "Contact my embassy" };

export default async function EmbassyPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { user } = await requireCitizen();
  const [trips, allMissions] = await Promise.all([getUserTrips(user.id), listMissionsWithJurisdictions()]);
  const open = trips.filter((t) => t.status === "active" || t.status === "planned");
  const seen = new Map<string, { mission: Mission; country: string }>();
  let unrouted: string | null = null;
  for (const t of open) {
    const d = currentDestination(t);
    if (!d) continue;
    if (d.mission) { if (!seen.has(d.mission.id)) seen.set(d.mission.id, { mission: d.mission, country: d.country }); }
    else unrouted = d.country;
  }
  const mine = [...seen.values()];
  return (
    <div className="mx-auto max-w-5xl">
      <Flash notice={notice} />
      <PageHeader title="Contact my embassy" description="Who is responsible for where you are, how to reach them, and how to book or send feedback." actions={<ButtonLink href="/app/appointments/book" variant="teal">Book an appointment</ButtonLink>} />
      {mine.length === 0 && (
        <Notice tone="info" className="mb-6" title="No registered trip yet">Register a trip to see the mission responsible for your destination, or <Link className="underline" href="/embassies">search the directory</Link>.</Notice>
      )}
      {unrouted && <Notice tone="warning" className="mb-6" title={`No Kenyan mission covers ${unrouted} in this demo`}>Fallback line: {FALLBACK_CONTACT.name}, {FALLBACK_CONTACT.phone} (demo placeholder).</Notice>}
      <div className="grid gap-5 lg:grid-cols-2">
        {mine.map(({ mission, country }) => <MissionContact key={mission.id} mission={mission} destinationCountry={country} />)}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><h2 className="font-semibold text-navy-950">Need help?</h2><p className="mb-3 text-sm text-navy-700">Request consular assistance or ask a general question.</p><ButtonLink href="/app/help" variant="outline" size="sm">Get help</ButtonLink></Card>
        <Card><h2 className="font-semibold text-navy-950">Guidance</h2><p className="mb-3 text-sm text-navy-700">Lost passport, detention, medical emergencies and more.</p><ButtonLink href="/guidance" variant="outline" size="sm">Read guidance</ButtonLink></Card>
        <Card><h2 className="font-semibold text-navy-950">Other missions</h2><p className="mb-3 text-sm text-navy-700">Travelling elsewhere? Look up who serves a country.</p><ButtonLink href="/embassies" variant="outline" size="sm">Embassy directory</ButtonLink></Card>
      </div>
      <Card className="mt-8">
        <SectionTitle>Help us improve</SectionTitle>
        <p className="mb-4 text-sm text-navy-700">Tell the mission what worked and what didn&apos;t. Feedback is <strong>not</strong> an assistance request and may not receive a reply — use “Get help” if you need assistance.</p>
        <ActionForm action={submitFeedback} resetOnSuccess className="max-w-xl space-y-4">
          <SelectField label="Which mission is this about?" name="missionId" required defaultValue={mine[0]?.mission.id ?? allMissions[0]?.id}>
            {allMissions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </SelectField>
          <SelectField label="Topic" name="topic" required defaultValue="Website">
            {["Website", "Alerts", "Appointments", "Case handling", "Other"].map((t) => <option key={t}>{t}</option>)}
          </SelectField>
          <RadioCards name="rating" legend="How was your experience?" required columns={2} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} – ${["", "Poor", "Fair", "Okay", "Good", "Excellent"][n]}` }))} />
          <TextAreaField label="Your feedback" name="message" required maxLength={1000} rows={4} />
          <SubmitButton variant="teal" pendingLabel="Sending…">Send feedback</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
