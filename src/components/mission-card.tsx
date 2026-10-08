import Link from "next/link";
import { LOCAL_EMERGENCY, MISSION_KIND } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { Mission } from "@/lib/types";
import { Badge, DemoNote, cx } from "./ui";

/** Contact card for a mission. Addresses and phone numbers in the pilot are placeholders and are labelled as such. */
export function MissionContact({ mission, destinationCountry, className, showLink = true }: { mission: Mission; destinationCountry?: string; className?: string; showLink?: boolean }) {
  const local = LOCAL_EMERGENCY[destinationCountry ?? mission.country];
  const servedFromElsewhere = destinationCountry && destinationCountry !== mission.country;
  return (
    <div className={cx("rounded-2xl border border-navy-200 bg-white p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{MISSION_KIND[mission.kind]}</p>
          <h3 className="text-lg font-semibold text-navy-950">
            {showLink ? <Link className="underline decoration-navy-300 underline-offset-4 hover:decoration-teal-700" href={`/embassies/${mission.id}`}>{mission.name}</Link> : mission.name}
          </h3>
        </div>
        <Badge tone="gold">Details to be confirmed</Badge>
      </div>
      {servedFromElsewhere && (
        <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-800">
          Kenya has no resident mission in {destinationCountry}. Kenyans there are served from {mission.city}, {mission.country}.
        </p>
      )}
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="font-medium text-navy-600">Address</dt><dd>{mission.address}</dd></div>
        <div><dt className="font-medium text-navy-600">Opening hours</dt><dd>{mission.openingHours}<br /><span className="text-navy-600">Timezone: {mission.timezone}</span></dd></div>
        <div><dt className="font-medium text-navy-600">General phone</dt><dd>{mission.phone}<DemoNote /></dd></div>
        <div><dt className="font-medium text-navy-600">Mission emergency line</dt><dd className="font-semibold">{mission.emergencyPhone}<DemoNote>Not a working line</DemoNote></dd></div>
        <div><dt className="font-medium text-navy-600">Email</dt><dd className="break-all">{mission.email}</dd></div>
        <div><dt className="font-medium text-navy-600">Website</dt><dd className="break-all">{mission.website}</dd></div>
        <div className="sm:col-span-2"><dt className="font-medium text-navy-600">Local emergency services in {destinationCountry ?? mission.country}</dt>
          <dd>{local ? <>{local} <span className="text-xs text-navy-600">(public reference – not verified by this pilot; confirm locally)</span></> : "Not listed in this pilot – check official local sources."}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-navy-600">Sample verification date: {fmtDate(mission.lastVerifiedAt)} – the Ministry must confirm all details before launch.</p>
    </div>
  );
}
