import type { Metadata } from "next";
import { and, asc, eq, ne } from "drizzle-orm";
import { addJurisdiction, removeJurisdiction, removeService, saveMissionDetails, saveService } from "@/app/actions/staff";
import { db } from "@/db";
import { missionJurisdictions, missions, users } from "@/db/schema";
import { ActionButton, ActionForm, SelectField, SubmitButton, TextAreaField, TextField, CheckField } from "@/components/form";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, Card, DefList, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { COUNTRIES, ROLE_LABEL, can } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { UUID } from "@/lib/validation";

export const metadata: Metadata = { title: "Mission settings" };

export default async function MissionSettings({ searchParams }: { searchParams: Promise<{ mission?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireStaff();
  if (!can(user.role, "mission.view")) return <AccessDenied permission="mission.view" role={user.role} />;
  const all = await db.select().from(missions).orderBy(asc(missions.country), asc(missions.city));
  const chosenId = user.role === "platform_admin" && sp.mission && UUID.test(sp.mission) ? sp.mission : user.missionId ?? all[0]?.id;
  const m = all.find((x) => x.id === chosenId);
  if (!m) return <p>Mission not found.</p>;
  const canEdit = can(user.role, "mission.edit") && (user.role === "platform_admin" || user.missionId === m.id);
  const [juris, staff] = await Promise.all([
    db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, m.id)).orderBy(asc(missionJurisdictions.country), asc(missionJurisdictions.region)),
    db.select().from(users).where(and(eq(users.missionId, m.id), ne(users.role, "citizen"))).orderBy(asc(users.displayName)),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Mission settings" eyebrow={m.name} description="What citizens see in the directory: contact details, countries served, services and opening hours." />
      {user.role === "platform_admin" && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div><label htmlFor="mission" className="mb-1 block text-sm font-semibold">Mission</label>
            <select id="mission" name="mission" defaultValue={m.id} className="min-h-11 rounded-lg border border-navy-300 bg-white px-3">{all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <button className="min-h-11 rounded-lg bg-navy-900 px-4 font-semibold text-white">Open</button>
        </form>
      )}
      {!canEdit && <Notice tone="info" title="Read-only">Only mission administrators can edit these settings. You can see what citizens see.</Notice>}

      <Card>
        <SectionTitle action={<Badge tone="teal">Last verified {fmtDate(m.lastVerifiedAt)}</Badge>}>Contact details and opening hours</SectionTitle>
        {canEdit ? (
          <ActionForm action={saveMissionDetails.bind(null, m.id)}>
            <TextField label="Name" name="name" required defaultValue={m.name} />
            <TextAreaField label="Address" name="address" required defaultValue={m.address} rows={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="General phone" name="phone" required defaultValue={m.phone} hint="Demo numbers use the unassigned +000 prefix." />
              <TextField label="Emergency phone" name="emergencyPhone" required defaultValue={m.emergencyPhone} hint="Only publish a number that is staffed and verified." />
              <TextField label="Email" name="email" type="email" required defaultValue={m.email} />
              <TextField label="Website" name="website" type="url" required defaultValue={m.website} />
              <TextField label="Timezone (IANA)" name="timezone" required defaultValue={m.timezone} hint="e.g. Europe/Lisbon. Appointment times use this." />
            </div>
            <TextAreaField label="Opening hours" name="openingHours" required defaultValue={m.openingHours} rows={2} />
            <CheckField name="verify" label="I have checked these details and want to mark them as verified today" />
            <SubmitButton variant="teal">Save mission details</SubmitButton>
          </ActionForm>
        ) : (
          <DefList items={[{ label: "Address", value: m.address }, { label: "Opening hours", value: m.openingHours }, { label: "Phone", value: m.phone }, { label: "Emergency phone", value: m.emergencyPhone }, { label: "Email", value: m.email }, { label: "Website", value: m.website }, { label: "Timezone", value: m.timezone }]} />
        )}
      </Card>

      <Card>
        <SectionTitle>Countries and regions served</SectionTitle>
        <ul className="mb-4 divide-y divide-navy-100 rounded-xl border border-navy-100">
          {juris.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="font-medium">{j.country}{j.region ? ` – ${j.region}` : " (whole country)"}</span>
              {canEdit && <ActionButton action={removeJurisdiction.bind(null, m.id, j.id)}>Remove</ActionButton>}
            </li>
          ))}
        </ul>
        {canEdit && (
          <ActionForm action={addJurisdiction.bind(null, m.id)} resetOnSuccess className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <SelectField label="Country" name="country" required>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</SelectField>
            <TextField label="Region (optional)" name="region" optional hint="Leave blank for the whole country." />
            <div><SubmitButton variant="outline">Add to jurisdiction</SubmitButton></div>
          </ActionForm>
        )}
        <p className="mt-3 text-xs text-navy-600">Changing jurisdiction does not move existing registrations automatically. Routing applies to new registrations.</p>
      </Card>

      <Card>
        <SectionTitle>Services and document requirements</SectionTitle>
        <ul className="space-y-3">
          {m.services.map((s) => (
            <li key={s.id} className="rounded-xl border border-navy-100 p-3">
              {canEdit ? (
                <details>
                  <summary className="cursor-pointer font-semibold text-navy-950">{s.name} <span className="font-normal text-navy-600">· {s.durationMin} min · {s.documents.length} documents</span></summary>
                  <ActionForm action={saveService.bind(null, m.id)} className="mt-3">
                    <input type="hidden" name="id" value={s.id} />
                    <TextField label="Service name" name="name" required defaultValue={s.name} />
                    <TextAreaField label="Description" name="description" required defaultValue={s.description} rows={2} />
                    <TextAreaField label="Documents to bring (one per line)" name="documents" defaultValue={s.documents.join("\n")} rows={4} />
                    <TextField label="Appointment length (minutes)" name="durationMin" type="number" min={5} max={180} required defaultValue={s.durationMin} />
                    <div className="flex flex-wrap gap-2"><SubmitButton variant="teal" size="sm">Save service</SubmitButton></div>
                  </ActionForm>
                  <div className="mt-2"><ActionButton variant="ghost" action={removeService.bind(null, m.id, s.id)}>Remove this service</ActionButton></div>
                </details>
              ) : (
                <><p className="font-semibold text-navy-950">{s.name}</p><p className="text-sm text-navy-700">{s.description}</p></>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <details className="mt-4 rounded-xl border border-dashed border-navy-300 p-3">
            <summary className="cursor-pointer font-semibold text-navy-950">+ Add a service</summary>
            <ActionForm action={saveService.bind(null, m.id)} resetOnSuccess className="mt-3">
              <TextField label="Service name" name="name" required />
              <TextAreaField label="Description" name="description" required rows={2} />
              <TextAreaField label="Documents to bring (one per line)" name="documents" rows={4} />
              <TextField label="Appointment length (minutes)" name="durationMin" type="number" min={5} max={180} required defaultValue={30} />
              <SubmitButton variant="outline">Add service</SubmitButton>
            </ActionForm>
          </details>
        )}
      </Card>

      <Card>
        <SectionTitle>Staff in this mission</SectionTitle>
        <ul className="divide-y divide-navy-100">{staff.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-medium">{s.displayName}</span><Badge tone={s.role === "mission_admin" ? "navy" : "teal"}>{ROLE_LABEL[s.role]}</Badge></li>)}</ul>
      </Card>
    </div>
  );
}
