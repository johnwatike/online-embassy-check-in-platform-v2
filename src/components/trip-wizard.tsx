"use client";

import { useRef, useState } from "react";
import { COUNTRIES, LOCAL_EMERGENCY, PURPOSES } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { resolveRouting } from "@/lib/routing";
import type { ActionState, RoutingEntry } from "@/lib/types";
import { ActionForm, CheckField, RadioCards, SelectField, SubmitButton, TextField } from "./form";
import { Notice, btn, cx } from "./ui";

type Dest = { country: string; region: string; arrivalDate: string; departureDate: string; unknown: boolean };
type Dep = { fullName: string; relationship: string; birthYear: string; consent: boolean };
export type WizardInitial = {
  stage: "planning" | "arrived";
  purpose: string;
  destinations: { country: string; region: string; arrivalDate: string; departureDate: string }[];
  accommodation: string;
  contactPhone: string;
  contactEmail: string;
  prefs: { email: boolean; sms: boolean; push: boolean; reminders: boolean };
  existingDependants: { fullName: string; relationship: string }[];
};

const STEPS = ["Trip", "Contact", "Family", "Alerts", "Review"];
const blankDest = (today: string): Dest => ({ country: "", region: "", arrivalDate: today, departureDate: "", unknown: false });

export function TripWizard(props: { mode: "create" | "edit"; routing: RoutingEntry[]; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; initial: WizardInitial; today: string; cancelHref: string }) {
  return (
    <ActionForm action={props.action} hideMessage={false} className="space-y-6">
      <Inner {...props} />
    </ActionForm>
  );
}

function Inner({ mode, routing, initial, today, cancelHref }: { mode: "create" | "edit"; routing: RoutingEntry[]; initial: WizardInitial; today: string; cancelHref: string }) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState(initial.stage);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [dests, setDests] = useState<Dest[]>(initial.destinations.length ? initial.destinations.map((d) => ({ ...d, unknown: !d.departureDate })) : [blankDest(today)]);
  const [accommodation, setAccommodation] = useState(initial.accommodation);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [deps, setDeps] = useState<Dep[]>([]);
  const [prefs, setPrefs] = useState(initial.prefs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const last = STEPS.length - 1;

  const setDest = (i: number, patch: Partial<Dest>) => setDests((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setDep = (i: number, patch: Partial<Dep>) => setDeps((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!purpose) e.purpose = "Choose a purpose of travel";
      dests.forEach((d, i) => {
        if (!d.country) e[`d${i}country`] = "Choose a country";
        if (!d.arrivalDate) e[`d${i}arrival`] = "Enter an arrival date";
        if (!d.unknown && !d.departureDate) e[`d${i}departure`] = "Enter a departure date or tick “I don't know yet”";
        if (d.unknown && i < dests.length - 1) e[`d${i}departure`] = "Add a departure date, since you travel on to another country";
        if (d.arrivalDate && d.departureDate && !d.unknown && d.departureDate < d.arrivalDate) e[`d${i}departure`] = "Departure can't be before arrival";
        if (i > 0 && d.arrivalDate && dests[i - 1].arrivalDate && d.arrivalDate < dests[i - 1].arrivalDate) e[`d${i}arrival`] = "Can't be before the previous stop";
      });
      if (mode === "create" && dests[0].arrivalDate) {
        if (stage === "planning" && dests[0].arrivalDate < today) e.d0arrival = "For a future trip, arrival must be today or later";
        if (stage === "arrived" && dests[0].arrivalDate > today) e.d0arrival = "You can't have arrived on a future date";
      }
    }
    if (s === 1) {
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) e.contactEmail = "Enter a valid email address";
      if (contactPhone && !/^[0-9 ()\-.+]{4,30}$/.test(contactPhone)) e.contactPhone = "Use digits, spaces, + and dashes only";
    }
    if (s === 2) {
      deps.forEach((d, i) => {
        if (!d.fullName.trim()) e[`dep${i}name`] = "Enter their name";
        if (!d.relationship) e[`dep${i}rel`] = "Choose a relationship";
        if (!d.consent) e[`dep${i}consent`] = "Consent is required to register this person";
        if (d.birthYear && (+d.birthYear < 1900 || +d.birthYear > new Date().getFullYear())) e[`dep${i}year`] = "Enter a valid year";
      });
    }
    return e;
  }

  function go(to: number) {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = validate(s);
        if (Object.keys(e).length) {
          setErrors(e);
          setStep(s);
          return;
        }
      }
    }
    setErrors({});
    setStep(to);
    setTimeout(() => headingRef.current?.focus(), 0);
  }

  const payload = JSON.stringify({
    stage,
    purpose,
    destinations: dests.map((d) => ({ country: d.country, region: d.region, arrivalDate: d.arrivalDate, departureDate: d.unknown ? "" : d.departureDate })),
    accommodation,
    contactPhone,
    contactEmail,
    dependants: deps.filter((d) => d.fullName.trim()).map((d) => ({ fullName: d.fullName, relationship: d.relationship, birthYear: d.birthYear ? Number(d.birthYear) : null, consent: d.consent })),
    prefs,
  });

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Enter" && step < last && (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "checkbox") {
          e.preventDefault();
          go(step + 1);
        }
      }}
    >
      <input type="hidden" name="payload" value={payload} />
      <ol className="mb-6 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <div className={cx("h-1.5 rounded-full", i <= step ? "bg-teal-700" : "bg-navy-200")} />
            <p className={cx("mt-1 hidden text-xs sm:block", i === step ? "font-semibold text-navy-950" : "text-navy-600")}>{i + 1}. {s}</p>
          </li>
        ))}
      </ol>
      <p className="mb-2 text-sm text-navy-600 sm:hidden">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      {step === 0 && (
        <div className="space-y-6">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold text-navy-950 outline-none">{mode === "create" ? "Where are you going?" : "Where and when?"}</h2>
          {mode === "create" && (
            <RadioCards
              name="stage"
              legend="Where are you in your journey?"
              value={stage}
              onChange={(v) => setStage(v as "planning" | "arrived")}
              options={[
                { value: "planning", label: "I'm planning to travel", description: "Register before you leave. You can confirm arrival later." },
                { value: "arrived", label: "I've already arrived", description: "Check in now so the embassy knows you're there." },
              ]}
              columns={2}
            />
          )}
          {dests.map((d, i) => {
            const route = d.country ? resolveRouting(routing, d.country, d.region) : null;
            return (
              <fieldset key={i} className="space-y-4 rounded-2xl border border-navy-200 bg-white p-4 sm:p-5">
                <legend className="px-2 text-base font-semibold text-navy-950">{dests.length > 1 ? `Stop ${i + 1}` : "Destination"}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Destination country" name={`d${i}c`} required value={d.country} error={errors[`d${i}country`]} onChange={(e) => setDest(i, { country: e.target.value })}>
                    <option value="">Choose a country…</option>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </SelectField>
                  <TextField label="City or region" name={`d${i}r`} optional value={d.region} maxLength={120} onChange={(e) => setDest(i, { region: e.target.value })} hint="e.g. Faro, Algarve. This helps route you to the right office." />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Arrival date" name={`d${i}a`} type="date" required value={d.arrivalDate} min={mode === "create" && stage === "planning" && i === 0 ? today : undefined} max={mode === "create" && stage === "arrived" && i === 0 ? today : undefined} error={errors[`d${i}arrival`]} onChange={(e) => setDest(i, { arrivalDate: e.target.value })} />
                  <div className="space-y-2">
                    <TextField label="Expected departure date" name={`d${i}d`} type="date" disabled={d.unknown} value={d.unknown ? "" : d.departureDate} min={d.arrivalDate} error={errors[`d${i}departure`]} onChange={(e) => setDest(i, { departureDate: e.target.value })} />
                    <CheckField name={`d${i}u`} label="I don't know yet" checked={d.unknown} onChange={(e) => setDest(i, { unknown: e.target.checked, departureDate: "" })} />
                  </div>
                </div>
                {d.country && (
                  <div aria-live="polite">
                    {route ? (
                      <Notice tone="info" title={`Responsible mission: ${route.missionName}`}>
                        {route.missionCountry === d.country ? `Based in ${route.missionCity}.` : `Kenya has no resident mission in ${d.country}. You'll be served from ${route.missionCity}, ${route.missionCountry}.`}
                      </Notice>
                    ) : (
                      <Notice tone="warning" title={`No mission covers ${d.country} in this demo`}>
                        You can still record this trip, but no mission will see it. Local emergency numbers{LOCAL_EMERGENCY[d.country] ? ` (${LOCAL_EMERGENCY[d.country]})` : ""} and the fallback operations contact are on the “Get urgent help” page.
                      </Notice>
                    )}
                  </div>
                )}
                {dests.length > 1 && <button type="button" className={btn("ghost", "sm")} onClick={() => setDests((ds) => ds.filter((_, j) => j !== i))}>Remove this stop</button>}
              </fieldset>
            );
          })}
          {dests.length < 6 && (
            <button type="button" className={btn("outline")} onClick={() => setDests((ds) => [...ds, { ...blankDest(ds[ds.length - 1].departureDate || ds[ds.length - 1].arrivalDate || today), unknown: false }])}>
              + Add another country on this trip
            </button>
          )}
          <SelectField label="Purpose of travel" name="purpose" required value={purpose} error={errors.purpose} onChange={(e) => setPurpose(e.target.value)} hint="Helps the embassy understand what kind of support may be relevant.">
            <option value="">Choose…</option>
            {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </SelectField>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold text-navy-950 outline-none">How can we reach you while you&apos;re there?</h2>
          <p className="text-navy-700">Everything on this page is optional. Share only what you&apos;re comfortable with.</p>
          <TextField label="Accommodation address or area" name="accommodation" optional maxLength={300} value={accommodation} onChange={(e) => setAccommodation(e.target.value)} hint="Why we ask: only so the embassy can find you in an emergency. It is not shared with anyone else. A neighbourhood is enough." />
          <TextField label="Phone number while abroad" name="contactPhone" type="tel" optional value={contactPhone} error={errors.contactPhone} onChange={(e) => setContactPhone(e.target.value)} hint="Include the dialling code if it's different from your profile phone." />
          <TextField label="Email while abroad" name="contactEmail" type="email" optional value={contactEmail} error={errors.contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold text-navy-950 outline-none">Is anyone travelling with you?</h2>
          <p className="text-navy-700">Optional. Add children or dependants you are responsible for, or adults who have agreed. They are linked to this trip only; nothing is shared with other people.</p>
          {initial.existingDependants.length > 0 && (
            <div className="rounded-xl bg-navy-50 p-4">
              <p className="font-semibold text-navy-950">Already registered on this trip</p>
              <ul className="mt-1 list-disc pl-5 text-navy-800">{initial.existingDependants.map((d) => <li key={d.fullName}>{d.fullName} ({d.relationship})</li>)}</ul>
            </div>
          )}
          {deps.map((d, i) => (
            <fieldset key={i} className="space-y-3 rounded-2xl border border-navy-200 bg-white p-4">
              <legend className="px-2 font-semibold text-navy-950">Person {i + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Full name" name={`dep${i}n`} required value={d.fullName} error={errors[`dep${i}name`]} onChange={(e) => setDep(i, { fullName: e.target.value })} />
                <SelectField label="Relationship" name={`dep${i}r`} required value={d.relationship} error={errors[`dep${i}rel`]} onChange={(e) => setDep(i, { relationship: e.target.value })}>
                  <option value="">Choose…</option>
                  {["Spouse or partner", "Child", "Parent", "Other relative", "Travelling companion"].map((r) => <option key={r}>{r}</option>)}
                </SelectField>
              </div>
              <TextField label="Year of birth" name={`dep${i}y`} optional inputMode="numeric" value={d.birthYear} error={errors[`dep${i}year`]} onChange={(e) => setDep(i, { birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} hint="Why we ask: it helps the embassy know whether a minor is involved." />
              <CheckField name={`dep${i}c`} label="I'm their parent or guardian, or they have agreed to be registered." checked={d.consent} error={errors[`dep${i}consent`]} onChange={(e) => setDep(i, { consent: e.target.checked })} />
              <button type="button" className={btn("ghost", "sm")} onClick={() => setDeps((ds) => ds.filter((_, j) => j !== i))}>Remove person</button>
            </fieldset>
          ))}
          {deps.length < 8 && <button type="button" className={btn("outline")} onClick={() => setDeps((ds) => [...ds, { fullName: "", relationship: "", birthYear: "", consent: false }])}>+ Add a person</button>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold text-navy-950 outline-none">How should the embassy get in touch?</h2>
          <fieldset className="space-y-3 rounded-2xl border border-navy-200 bg-white p-4">
            <legend className="px-2 font-semibold text-navy-950">Channels (delivery is simulated in this demo)</legend>
            <CheckField name="pe" label="Email" checked={prefs.email} onChange={(e) => setPrefs({ ...prefs, email: e.target.checked })} />
            <CheckField name="ps" label="SMS" checked={prefs.sms} onChange={(e) => setPrefs({ ...prefs, sms: e.target.checked })} />
            <CheckField name="pp" label="Push notifications" checked={prefs.push} onChange={(e) => setPrefs({ ...prefs, push: e.target.checked })} />
          </fieldset>
          <CheckField name="pr" label="Send me occasional reminders to confirm my details or wellbeing" hint="Optional. Missing a reminder never marks you as missing or in danger." checked={prefs.reminders} onChange={(e) => setPrefs({ ...prefs, reminders: e.target.checked })} />
          <Notice tone="info" title="Urgent alerts">You can choose in your profile whether urgent safety alerts may use every channel you've given us, even ones you've switched off. This saves your choices for future trips too.</Notice>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold text-navy-950 outline-none">Review and {mode === "create" ? "submit" : "save"}</h2>
          <dl className="divide-y divide-navy-100 rounded-2xl border border-navy-200 bg-white">
            {dests.map((d, i) => {
              const r = resolveRouting(routing, d.country, d.region);
              return (
                <div key={i} className="grid gap-1 p-4 sm:grid-cols-3">
                  <dt className="font-medium text-navy-600">{dests.length > 1 ? `Stop ${i + 1}` : "Destination"}</dt>
                  <dd className="sm:col-span-2"><span className="font-semibold">{d.country}</span>{d.region ? `, ${d.region}` : ""}<br />{fmtDate(d.arrivalDate)} → {d.unknown ? "departure date not known yet" : fmtDate(d.departureDate)}<br /><span className="text-sm text-navy-600">{r ? `Mission: ${r.missionName}` : "No mission in this demo"}</span></dd>
                </div>
              );
            })}
            <Row label="Status" value={mode === "create" ? (stage === "arrived" ? "Registered as arrived (active)" : "Registered as upcoming") : "Changes to your existing registration"} />
            <Row label="Purpose" value={PURPOSES[purpose] ?? "—"} />
            <Row label="Accommodation" value={accommodation || "Not provided"} />
            <Row label="Contact abroad" value={[contactPhone, contactEmail].filter(Boolean).join(" · ") || "Not provided"} />
            <Row label="Dependants" value={deps.filter((d) => d.fullName).map((d) => d.fullName).join(", ") || (initial.existingDependants.length ? "No new dependants" : "None")} />
            <Row label="Notifications" value={[prefs.email && "Email", prefs.sms && "SMS", prefs.push && "Push"].filter(Boolean).join(", ") || "None selected"} />
          </dl>
          <Notice tone="warning" title="Please note">Registering with the embassy does not replace visas or immigration registration, and does not replace local emergency services. Assistance is not guaranteed.</Notice>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {step > 0 ? <button type="button" className={btn("outline", "lg")} onClick={() => go(step - 1)}>Back</button> : <a className={btn("ghost", "lg")} href={cancelHref}>Cancel</a>}
        </div>
        {step < last ? (
          <button type="button" className={btn("teal", "lg")} onClick={() => go(step + 1)}>Continue</button>
        ) : (
          <SubmitButton variant="teal" size="lg" pendingLabel="Submitting…">{mode === "create" ? "Submit registration" : "Save changes"}</SubmitButton>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-3">
      <dt className="font-medium text-navy-600">{label}</dt>
      <dd className="sm:col-span-2">{value}</dd>
    </div>
  );
}
