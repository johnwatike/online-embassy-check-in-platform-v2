import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { expireAlert, publishAlert } from "@/app/actions/staff";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { ActionButton } from "@/components/form";
import { AccessDenied, MissionScopeNote } from "@/components/staff-bits";
import { Badge, ButtonLink, EmptyState, Flash, PageHeader, tableCls } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { ALERT_CATEGORY, SEVERITY, can } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Alerts" };

export default async function StaffAlerts({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { user, mission } = await requireStaff();
  if (!can(user.role, "alerts.draft")) return <AccessDenied permission="alerts.draft" role={user.role} />;
  const rows = await db.select().from(alerts).where(eq(alerts.missionId, user.missionId!)).orderBy(desc(alerts.createdAt));
  const canPublish = can(user.role, "alerts.publish");
  const tz = mission?.timezone ?? "UTC";
  const now = new Date();
  return (
    <div className="mx-auto max-w-7xl">
      <Flash notice={notice} />
      <PageHeader title="Alerts" description="Draft, preview, publish and expire verified alerts for the countries your mission serves." actions={<ButtonLink href="/staff/alerts/new" variant="teal">New alert</ButtonLink>} />
      <MissionScopeNote name={mission?.name ?? null} />
      {!canPublish && <p className="mb-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-800">Your role can draft alerts. A mission administrator publishes and expires them.</p>}
      {rows.length === 0 ? <EmptyState title="No alerts yet" icon="🔔" action={<ButtonLink href="/staff/alerts/new" variant="teal">Draft an alert</ButtonLink>} /> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <caption className="sr-only">Alerts for your mission</caption>
            <thead><tr>{["Alert", "Severity", "Affected", "Recipients", "Status", "Published / expires", ""].map((h) => <th key={h} scope="col" className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((a) => {
                const live = a.status === "published" && (!a.expiresAt || a.expiresAt > now);
                const state = a.status === "draft" ? "Draft" : live ? "Live" : "Expired";
                return (
                  <tr key={a.id}>
                    <td className={tableCls.td}><p className="font-semibold text-navy-950">{a.title}</p><p className="text-xs text-navy-600">{ALERT_CATEGORY[a.category]}</p></td>
                    <td className={tableCls.td}><Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge></td>
                    <td className={tableCls.td}>{a.country}{a.region ? `, ${a.region}` : ""}<p className="text-xs text-navy-600">Audience: {a.audience}</p></td>
                    <td className={tableCls.td}>{a.status === "draft" ? "–" : a.recipientCount}<p className="text-xs text-navy-600">{a.status === "draft" ? "" : "simulated delivery"}</p></td>
                    <td className={tableCls.td}><Badge tone={state === "Live" ? "green" : state === "Draft" ? "amber" : "neutral"}>{state}</Badge></td>
                    <td className={tableCls.td}><p className="text-sm">{a.publishedAt ? fmtDateTime(a.publishedAt, tz) : "—"}</p><p className="text-xs text-navy-600">{a.expiresAt ? `Expires ${fmtDateTime(a.expiresAt, tz)}` : "No expiry"}</p></td>
                    <td className={tableCls.td}>
                      {canPublish && a.status === "draft" && <ActionButton variant="teal" action={publishAlert.bind(null, a.id)}>Publish</ActionButton>}
                      {canPublish && live && <ActionButton action={expireAlert.bind(null, a.id)}>Expire now</ActionButton>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-navy-600">Times shown in the mission timezone ({tz}).</p>
    </div>
  );
}
