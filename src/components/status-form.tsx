"use client";

import { useState } from "react";
import { EMERGENCY_DISCLAIMER } from "@/lib/constants";
import type { ActionState } from "@/lib/types";
import { ActionForm, CheckField, RadioCards, SelectField, SubmitButton, TextAreaField, TextField } from "./form";
import { Notice, btn } from "./ui";

type Trip = { id: string; label: string; status: string };
type Option = { value: string; label: string; description: string; icon: string };

export function StatusForm({ trips, action, defaultTripId, options, question }: { trips: Trip[]; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; defaultTripId: string; options: Option[]; question: string }) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-6">
      <Inner trips={trips} defaultTripId={defaultTripId} options={options} question={question} />
    </ActionForm>
  );
}

function Inner({ trips, defaultTripId, options, question }: { trips: Trip[]; defaultTripId: string; options: Option[]; question: string }) {
  const [status, setStatus] = useState("");
  const [review, setReview] = useState(false);
  const urgent = status === "need_assistance";

  return (
    <>
      <div hidden={review} className="space-y-6">
        {trips.length > 1 ? (
          <SelectField label="Which trip is this about?" name="tripId" required defaultValue={defaultTripId}>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </SelectField>
        ) : (
          <input type="hidden" name="tripId" value={trips[0].id} />
        )}
        <RadioCards name="status" legend={question} required value={status} onChange={setStatus} options={options} columns={2} />
        {status === "left_country" && <CheckField name="closeTrip" label="Also close this trip" hint="Recommended. Your trip is marked closed and its history is kept." defaultChecked />}
        <TextAreaField label="Add a note" name="note" optional maxLength={500} placeholder="Anything you'd like the embassy to know" hint={urgent ? "Describe what's happening. This becomes the first message of your request." : "Optional. Don't include passport numbers or other sensitive details here."} />
        {urgent ? (
          <button type="button" className={btn("danger", "lg")} onClick={() => setReview(true)}>Review my urgent request</button>
        ) : (
          <SubmitButton variant="teal" size="lg" disabled={!status} pendingLabel="Sending…">Send update</SubmitButton>
        )}
      </div>

      {review && (
        <div className="space-y-5" role="region" aria-label="Review urgent assistance request">
          <h2 className="font-serif text-2xl font-semibold text-navy-950">Review before you send</h2>
          <Notice tone="danger" title="Online requests may not be monitored continuously">{EMERGENCY_DISCLAIMER} Submitting does not guarantee an immediate response, evacuation or financial help.</Notice>
          <TextField label="Where are you right now?" name="location" required maxLength={200} hint="A town, neighbourhood or landmark is enough." />
          <RadioCards name="contactMethod" legend="Best way to reach you" defaultValue="phone" required options={[{ value: "phone", label: "Phone call", description: "Using the number in your profile" }, { value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} columns={2} />
          <CheckField name="acknowledge" label="I understand this is an online request, and that I should contact local emergency services if there is immediate danger." />
          <div className="flex flex-wrap gap-3">
            <button type="button" className={btn("outline", "lg")} onClick={() => setReview(false)}>Back</button>
            <SubmitButton variant="danger" size="lg" pendingLabel="Submitting…">Submit urgent request</SubmitButton>
          </div>
        </div>
      )}
    </>
  );
}
