"use client";

import { useState } from "react";
import { CRISIS_ANSWER } from "@/lib/constants";
import type { ActionState } from "@/lib/types";
import { ActionForm, CheckField, RadioCards, SubmitButton, TextAreaField, TextField } from "./form";
import { Notice, btn } from "./ui";

export function CrisisResponseForm({ action, requestLocation, initial }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; requestLocation: boolean; initial: { response: string; note: string; location: string } }) {
  return (
    <ActionForm action={action} className="space-y-6">
      <Inner requestLocation={requestLocation} initial={initial} />
    </ActionForm>
  );
}

function Inner({ requestLocation, initial }: { requestLocation: boolean; initial: { response: string; note: string; location: string } }) {
  const [answer, setAnswer] = useState(initial.response);
  const [share, setShare] = useState(!!initial.location);
  const [loc, setLoc] = useState(initial.location);
  const [geoMsg, setGeoMsg] = useState("");

  function useDevice() {
    if (!navigator.geolocation) return setGeoMsg("Your browser can't share a location. You can type one instead.");
    setGeoMsg("Asking your device…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc(`${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)} (approximate device location, shared once)`);
        setGeoMsg("Approximate location added. It is only sent if you press Send response.");
      },
      () => setGeoMsg("We couldn't get your location. You can type it instead, or skip this."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <>
      <RadioCards
        name="response"
        legend="Your response"
        required
        value={answer}
        onChange={setAnswer}
        options={(Object.keys(CRISIS_ANSWER) as (keyof typeof CRISIS_ANSWER)[]).map((k) => ({ value: k, label: CRISIS_ANSWER[k].label, description: CRISIS_ANSWER[k].description }))}
      />
      {answer === "need_help" && <Notice tone="danger" title="If you're in immediate danger">Call local emergency services now. This response alerts embassy staff, but it may not be seen straight away. You can also submit a full request from “Get help”.</Notice>}
      <TextAreaField label="Add a note" name="note" optional maxLength={500} defaultValue={initial.note} rows={3} />
      {requestLocation && answer && answer !== "not_affected" && (
        <fieldset className="space-y-3 rounded-2xl border-2 border-navy-200 bg-navy-50 p-4">
          <legend className="px-2 font-semibold text-navy-950">Share my location (optional)</legend>
          <p className="text-sm text-navy-800">This is <strong>only for this wellbeing check</strong>. It is not continuous tracking, it is never shared with your emergency contacts, and you can withdraw it afterwards. Skipping it does not affect how you are helped.</p>
          <CheckField name="shareLocation" label="Yes, I consent to share my location with the embassy for this request only" checked={share} onChange={(e) => setShare(e.target.checked)} />
          {share && (
            <div className="space-y-2">
              <TextField label="Approximate location" name="locationText" value={loc} maxLength={200} onChange={(e) => setLoc(e.target.value)} hint="A place name, neighbourhood or coordinates." />
              <button type="button" className={btn("outline", "sm")} onClick={useDevice}>Use my device location once</button>
              {geoMsg && <p className="text-sm text-navy-700" role="status">{geoMsg}</p>}
            </div>
          )}
        </fieldset>
      )}
      <SubmitButton variant="teal" size="lg" disabled={!answer} pendingLabel="Sending…">Send response</SubmitButton>
    </>
  );
}
