import type { Metadata } from "next";
import Link from "next/link";
import { createCase } from "@/app/actions/citizen";
import { tripTitle } from "@/components/citizen-bits";
import { ActionForm, CheckField, RadioCards, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { CASE_CATEGORIES, COUNTRIES, EMERGENCY_DISCLAIMER, URGENCY } from "@/lib/constants";
import { getUserTrips, pickCurrentTrip } from "@/lib/data";

export const metadata: Metadata = { title: "Request assistance" };

export default async function NewCase({ searchParams }: { searchParams: Promise<{ category?: string; urgency?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireCitizen();
  const all = await getUserTrips(user.id);
  const trips = all.filter((t) => t.status === "active" || t.status === "planned");
  const current = pickCurrentTrip(all);
  const category = sp.category && sp.category in CASE_CATEGORIES ? sp.category : "other";
  const urgency = sp.urgency && sp.urgency in URGENCY ? sp.urgency : "routine";
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm"><Link href="/app/help" className="underline">← Get help</Link></p>
      <PageHeader title="Request assistance" description="Give us the essentials. You can add more in the secure message thread afterwards." />
      <Notice tone="danger" className="mb-6" title="Before you continue">{EMERGENCY_DISCLAIMER} We can&apos;t promise evacuation, financial support or an immediate response.</Notice>
      <Card>
        <ActionForm action={createCase} className="space-y-6">
          <RadioCards name="category" legend="What do you need help with?" required defaultValue={category} options={(Object.keys(CASE_CATEGORIES) as (keyof typeof CASE_CATEGORIES)[]).map((k) => ({ value: k, label: CASE_CATEGORIES[k].label, description: CASE_CATEGORIES[k].description, icon: CASE_CATEGORIES[k].icon }))} columns={2} />
          <TextAreaField label="What is happening?" name="description" required maxLength={2000} rows={5} hint="A short description is enough. Don't include passport numbers or card details." />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Which trip is this about?" name="tripId" defaultValue={current?.id ?? ""} hint="This tells us which embassy is responsible.">
              <option value="">Not linked to a registered trip</option>
              {trips.map((t) => <option key={t.id} value={t.id}>{tripTitle(t)} · {t.reference}</option>)}
            </SelectField>
            <SelectField label="Country (only if no trip chosen)" name="country" defaultValue="" optional>
              <option value="">Choose…</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </SelectField>
          </div>
          <TextField label="Where are you?" name="location" required maxLength={200} hint="A town, neighbourhood or landmark. Why we ask: so the right office can respond." />
          <RadioCards name="urgency" legend="How urgent is it?" required defaultValue={urgency} options={(Object.keys(URGENCY) as (keyof typeof URGENCY)[]).map((k) => ({ value: k, label: URGENCY[k] }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Preferred contact method" name="contactMethod" required defaultValue="email">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="phone">Phone call</option>
            </SelectField>
            <TextField label="Contact detail" name="contactDetail" optional hint="Leave blank to use the details in your profile." />
          </div>
          <div>
            <TextField label="Attachment" name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" optional hint="Optional. PDF, JPG or PNG up to 2 MB, such as a police report. Don't upload anything you aren't comfortable sharing." />
          </div>
          <CheckField name="acknowledge" label="I understand that online requests may not be monitored continuously, and that I should contact local emergency services if there is immediate danger." />
          <SubmitButton variant="teal" size="lg" pendingLabel="Submitting…">Submit request</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
