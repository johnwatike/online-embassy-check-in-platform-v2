import type { Metadata } from "next";
import { addEmergencyContact, cancelDeletion, removeEmergencyContact, requestDeletion, saveNotificationPrefs, saveProfile } from "@/app/actions/citizen";
import { ConfirmDialog } from "@/components/dialog";
import { ActionButton, ActionForm, CheckField, SelectField, SubmitButton, TextField } from "@/components/form";
import { Card, Flash, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { DIAL_CODES, HOME_COUNTRY, LANGUAGES } from "@/lib/constants";
import { getContacts, getPrefs } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Profile and privacy" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { user, profile } = await requireCitizen();
  const [contacts, prefs] = await Promise.all([getContacts(user.id), getPrefs(user.id)]);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Flash notice={notice} />
      <PageHeader title="Profile and privacy" description="Keep your details correct and decide how the embassy can reach you." />

      <Card id="profile">
        <SectionTitle>Your details</SectionTitle>
        <ActionForm action={saveProfile} className="max-w-xl">
          <TextField label="Full name" name="fullName" required defaultValue={profile.fullName} autoComplete="name" />
          <TextField label="Email" name="email" type="email" required defaultValue={user.email} autoComplete="email" />
          <SelectField label="Citizenship" name="citizenship" required defaultValue={profile.citizenship}><option>{HOME_COUNTRY}</option></SelectField>
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <SelectField label="Dialling code" name="phoneDial" required defaultValue={profile.phoneDial}>{DIAL_CODES.map((c) => <option key={c}>{c}</option>)}</SelectField>
            <TextField label="Phone number" name="phoneNumber" type="tel" required defaultValue={profile.phoneNumber} />
          </div>
          <SelectField label="Preferred language" name="preferredLanguage" required defaultValue={profile.preferredLanguage} hint="Used when the embassy writes to you. Demo screens are English only.">{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</SelectField>
          <SubmitButton variant="teal">Save details</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="contacts">
        <SectionTitle>Emergency contacts</SectionTitle>
        <Notice tone="info" className="mb-4" title="Not shared automatically">Your status and location are <strong>never</strong> shared with emergency contacts automatically. The embassy only uses a contact if you ask, or where required to protect life.</Notice>
        {contacts.length === 0 ? <p className="mb-4 text-navy-700">No emergency contacts added. This is optional.</p> : (
          <ul className="mb-4 divide-y divide-navy-100 rounded-xl border border-navy-100">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div><p className="font-semibold text-navy-950">{c.name} <span className="font-normal text-navy-600">· {c.relationship}</span></p><p className="text-sm text-navy-700">{c.phone}{c.email ? ` · ${c.email}` : ""}</p></div>
                <ActionButton action={removeEmergencyContact.bind(null, c.id)}>Remove</ActionButton>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addEmergencyContact} resetOnSuccess className="max-w-xl">
          <h3 className="font-semibold text-navy-950">Add a contact</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" name="name" required />
            <TextField label="Relationship" name="relationship" required />
          </div>
          <TextField label="Phone (with dialling code)" name="phone" type="tel" required />
          <TextField label="Email" name="email" type="email" optional />
          <SubmitButton variant="outline">Add contact</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="notifications">
        <SectionTitle>Notifications and reminders</SectionTitle>
        <ActionForm action={saveNotificationPrefs} className="max-w-xl">
          <fieldset className="space-y-3">
            <legend className="font-semibold text-navy-950">Channels</legend>
            <p className="text-sm text-navy-600">Delivery is <strong>simulated</strong> in this demo: nothing is sent by email, SMS or push.</p>
            <CheckField name="email" label="Email" defaultChecked={prefs?.email ?? true} />
            <CheckField name="sms" label="SMS" defaultChecked={prefs?.sms ?? false} />
            <CheckField name="push" label="Push notifications" defaultChecked={prefs?.push ?? false} />
          </fieldset>
          <CheckField name="urgentOverride" label="Use every channel for urgent safety alerts" hint="If on, critical alerts may be sent on all channels you've given us – even ones you switched off above. If off, we only use the channels you selected." defaultChecked={prefs?.urgentOverride ?? true} />
          <SelectField label="Reminders to confirm my details or wellbeing" name="reminderFrequency" defaultValue={prefs?.reminders ? prefs.reminderFrequency : "off"} hint="Optional. Missing a reminder never marks you as missing or in danger.">
            <option value="off">No reminders</option>
            <option value="before_departure">Only before my departure date</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Every two weeks</option>
            <option value="monthly">Monthly</option>
          </SelectField>
          <SubmitButton variant="teal">Save notification settings</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="privacy">
        <SectionTitle>Your data and privacy</SectionTitle>
        <div className="space-y-3 text-navy-800">
          <p><strong>Why we hold it:</strong> your details help the embassy contact you and give assistance if you ask. We don&apos;t require passport numbers to register travel.</p>
          <p><strong>Retention:</strong> trips and wellbeing updates are kept for a configurable period after a trip closes. Assistance cases and audit logs may be kept longer where the law requires. (Demo values are illustrative.)</p>
          <p><strong>Correct:</strong> edit your profile above and your trips from “My trips”. <strong>Export:</strong> download everything we hold about you as a file. <strong>Delete:</strong> request deletion – some records may be retained to meet legal obligations.</p>
          <p className="text-sm text-navy-600">Read the <a className="underline" href="/privacy">full privacy information</a>.</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href="/api/me/export" className="inline-flex min-h-11 items-center rounded-lg border border-navy-300 bg-white px-4 font-semibold text-navy-900 hover:bg-navy-50">Download my data (JSON)</a>
          {user.deletionRequestedAt ? (
            <div className="flex flex-wrap items-center gap-3">
              <Notice tone="warning">Deletion requested on {fmtDateTime(user.deletionRequestedAt)}. In this demo nothing is deleted automatically.</Notice>
              <ActionButton action={cancelDeletion} size="md">Withdraw request</ActionButton>
            </div>
          ) : (
            <ConfirmDialog triggerLabel="Request deletion of my data" title="Request deletion?" description="We'll record your request. Records that must be kept by law (for example assistance cases and audit logs) may be retained for the required period. You can withdraw the request later." confirmLabel="Request deletion" confirmVariant="danger" action={requestDeletion} />
          )}
        </div>
      </Card>
    </div>
  );
}
