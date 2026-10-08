"use client";

import { useEffect, useState } from "react";
import { ALERT_CATEGORY, SEVERITY } from "@/lib/constants";
import type { ActionState } from "@/lib/types";
import { ActionForm, CheckField, SelectField, SubmitButton, TextAreaField, TextField } from "./form";
import { Badge, Notice, btn } from "./ui";

function useRecipientCount(country: string, region: string, audience: string) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!country) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/staff/recipients?${new URLSearchParams({ country, region, audience })}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { count: null }))
        .then((j) => setCount(j.count))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [country, region, audience]);
  return country ? count : null;
}

function RecipientCount({ count, noun }: { count: number | null; noun: string }) {
  return (
    <div className="rounded-xl border border-navy-200 bg-navy-50 p-4" aria-live="polite">
      <p className="text-sm font-medium text-navy-700">Intended recipients</p>
      <p className="font-serif text-3xl font-semibold text-navy-950">{count === null ? "–" : count}</p>
      <p className="text-xs text-navy-600">Registered citizens whose {noun} match. Counts only – no names are shown here. Delivery is simulated in this demo.</p>
    </div>
  );
}

export function AlertForm({ countries, canPublish, action }: { countries: string[]; canPublish: boolean; action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="space-y-6">
      <AlertInner countries={countries} canPublish={canPublish} />
    </ActionForm>
  );
}

function AlertInner({ countries, canPublish }: { countries: string[]; canPublish: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("safety");
  const [severity, setSeverity] = useState("advisory");
  const [country, setCountry] = useState(countries[0] ?? "");
  const [region, setRegion] = useState("");
  const [audience, setAudience] = useState("all");
  const [expiresOn, setExpiresOn] = useState("");
  const [confirming, setConfirming] = useState(false);
  const count = useRecipientCount(country, region, audience);
  const sev = SEVERITY[severity as keyof typeof SEVERITY];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <TextField label="Title" name="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Message" name="body" required maxLength={1500} rows={6} value={body} onChange={(e) => setBody(e.target.value)} hint="Plain language: what is happening, who is affected, what to do. Don't promise evacuation or financial help." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Type" name="category" required value={category} onChange={(e) => setCategory(e.target.value)}>
            {(["safety", "travel_guidance", "service_update"] as const).map((k) => <option key={k} value={k}>{ALERT_CATEGORY[k]}</option>)}
          </SelectField>
          <SelectField label="Severity" name="severity" required value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </SelectField>
          <SelectField label="Affected country" name="country" required value={country} onChange={(e) => setCountry(e.target.value)} hint="Only countries your mission serves.">
            {countries.map((c) => <option key={c}>{c}</option>)}
          </SelectField>
          <TextField label="Affected region or city" name="region" optional value={region} onChange={(e) => setRegion(e.target.value)} hint="Leave blank for the whole country." />
          <SelectField label="Audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">Everyone registered (upcoming and active)</option>
            <option value="active">Only citizens who have arrived</option>
            <option value="planned">Only citizens who are about to travel</option>
          </SelectField>
          <TextField label="Expires on" name="expiresOn" type="date" optional value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} hint="After this date the alert stops showing as active." />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="mb-2 font-semibold text-navy-950">Preview – what citizens will see</h2>
          <article className="rounded-2xl border border-navy-200 bg-white p-4 shadow-sm" aria-label="Alert preview">
            <div className="flex flex-wrap gap-1.5"><Badge tone={sev.tone}>{sev.label}</Badge><Badge>{ALERT_CATEGORY[category as keyof typeof ALERT_CATEGORY]}</Badge><Badge tone="teal">✓ Verified by your mission</Badge></div>
            <h3 className="mt-2 text-lg font-semibold text-navy-950">{title || "Alert title"}</h3>
            <p className="mt-1 whitespace-pre-line text-navy-800">{body || "Your message will appear here."}</p>
            <p className="mt-3 text-sm text-navy-700">Affected: {country}{region ? `, ${region}` : ""} · Expires: {expiresOn || "no expiry set"}</p>
          </article>
        </div>
        <RecipientCount count={count} noun="country, region and audience" />
        <div className="space-y-3">
          {!confirming ? (
            <div className="flex flex-wrap gap-3">
              <SubmitButton name="intent" value="draft" variant="outline" pendingLabel="Saving…">Save draft</SubmitButton>
              {canPublish ? (
                <button type="button" className={btn("teal")} onClick={() => setConfirming(true)}>Publish…</button>
              ) : null}
            </div>
          ) : (
            <Notice tone="warning" title={`Publish to ${count ?? "?"} intended recipients?`}>
              Published alerts show a “Verified” label and are logged in the audit history. Delivery by email, SMS and push is <strong>simulated</strong> in this demo.
              <div className="mt-3 flex flex-wrap gap-2">
                <SubmitButton name="intent" value="publish" variant="teal" pendingLabel="Publishing…">Confirm and publish</SubmitButton>
                <button type="button" className={btn("outline")} onClick={() => setConfirming(false)}>Back</button>
              </div>
            </Notice>
          )}
          {!canPublish && <p className="text-sm text-navy-600">Consular officers can draft alerts. A mission administrator must publish them.</p>}
        </div>
      </div>
    </div>
  );
}

export function CrisisForm({ countries, action }: { countries: string[]; action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="space-y-6">
      <CrisisInner countries={countries} />
    </ActionForm>
  );
}

function CrisisInner({ countries }: { countries: string[] }) {
  const [country, setCountry] = useState(countries[0] ?? "");
  const [region, setRegion] = useState("");
  const [confirming, setConfirming] = useState(false);
  const count = useRecipientCount(country, region, "active");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <TextField label="Event title" name="title" required maxLength={140} placeholder="e.g. Flooding in the northern region" />
        <TextAreaField label="Internal summary" name="description" required maxLength={1000} rows={3} hint="For staff records. Not sent to citizens." />
        <TextAreaField label="Message to citizens" name="message" required maxLength={1200} rows={6} hint="Explain what is happening, that replying is voluntary, and to call local emergency services if in immediate danger." />
      </div>
      <div className="space-y-4">
        <SelectField label="Affected country" name="country" required value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((c) => <option key={c}>{c}</option>)}</SelectField>
        <TextField label="Affected region or city" name="region" optional value={region} onChange={(e) => setRegion(e.target.value)} hint="Leave blank to target the whole country. Only citizens with an active trip there are asked." />
        <CheckField name="requestLocation" label="Allow citizens to optionally share their location for this request" hint="Never required. Consent is explicit, specific to this request, and revocable. Shared locations are purged when the check closes." />
        <RecipientCount count={count} noun="affected area" />
        {!confirming ? (
          <button type="button" className={btn("danger", "lg")} disabled={!count} onClick={() => setConfirming(true)}>Review and send wellbeing check…</button>
        ) : (
          <Notice tone="warning" title={`Send to ${count} citizens?`}>
            Citizens can answer “I&apos;m safe”, “I need help” or “I&apos;m not in the affected area”. People who don&apos;t answer are listed separately, and <strong>a non-response is never evidence that someone is missing or injured</strong>. Delivery is simulated in this demo.
            <div className="mt-3 flex flex-wrap gap-2">
              <SubmitButton variant="danger" pendingLabel="Sending…">Confirm and send</SubmitButton>
              <button type="button" className={btn("outline")} onClick={() => setConfirming(false)}>Back</button>
            </div>
          </Notice>
        )}
      </div>
    </div>
  );
}
