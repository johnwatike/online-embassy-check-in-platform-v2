import Link from "next/link";
import { markAlertRead } from "@/app/actions/citizen";
import { ALERT_CATEGORY, SEVERITY, TRIP_STATUS, WELLBEING } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { Alert, TripFull } from "@/lib/types";
import type { TripStatus, WellbeingStatus } from "@/db/schema";
import { ActionButton } from "./form";
import { Badge } from "./ui";

export const TripStatusBadge = ({ status }: { status: TripStatus }) => <Badge tone={TRIP_STATUS[status].tone}>{TRIP_STATUS[status].label}</Badge>;
export const WellbeingBadge = ({ status }: { status: WellbeingStatus }) => <Badge tone={WELLBEING[status].tone}><span aria-hidden>{WELLBEING[status].icon}</span> {WELLBEING[status].short}</Badge>;

export function tripTitle(t: TripFull) {
  return t.destinations.map((d) => d.country).join(" → ");
}

export function dateRange(start: string, end: string | null) {
  return `${fmtDate(start)} → ${end ? fmtDate(end) : "departure date not set"}`;
}

export type AlertView = Alert & { missionName: string; missionTz: string; readAt: Date | null; expired: boolean };

export function AlertCard({ alert, showRead = true }: { alert: AlertView; showRead?: boolean }) {
  const sev = SEVERITY[alert.severity];
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${alert.readAt ? "border-navy-100" : "border-l-4 border-navy-200 border-l-gold-500"} ${alert.expired ? "opacity-75" : ""}`} aria-label={alert.title}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={sev.tone}>{sev.label}</Badge>
        <Badge>{ALERT_CATEGORY[alert.category]}</Badge>
        <Badge tone="teal">✓ Verified by {alert.missionName}</Badge>
        {alert.expired && <Badge>Expired</Badge>}
        {!alert.readAt && <Badge tone="gold">Unread</Badge>}
      </div>
      <h3 className="mt-2 text-lg font-semibold text-navy-950">{alert.title}</h3>
      <p className="mt-1 whitespace-pre-line text-navy-800">{alert.body}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-navy-700 sm:grid-cols-3">
        <div><dt className="inline font-medium">Affected: </dt><dd className="inline">{alert.country}{alert.region ? `, ${alert.region}` : ""}</dd></div>
        <div><dt className="inline font-medium">Published: </dt><dd className="inline">{fmtDateTime(alert.publishedAt, alert.missionTz)}</dd></div>
        <div><dt className="inline font-medium">Expires: </dt><dd className="inline">{alert.expiresAt ? fmtDateTime(alert.expiresAt, alert.missionTz) : "No expiry set"}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {alert.category === "crisis" && alert.crisisEventId && !alert.expired && (
          <Link href={`/app/crisis/${alert.crisisEventId}`} className="inline-flex min-h-9 items-center rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800">Respond to the wellbeing check</Link>
        )}
        {showRead && !alert.readAt && <ActionButton action={markAlertRead.bind(null, alert.id)}>Mark as read</ActionButton>}
      </div>
    </article>
  );
}
