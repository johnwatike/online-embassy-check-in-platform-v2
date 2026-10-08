import type { Metadata } from "next";
import Link from "next/link";
import { markAllRead, markNotificationRead } from "@/app/actions/citizen";
import { AlertCard } from "@/components/citizen-bits";
import { ActionButton } from "@/components/form";
import { Badge, Card, EmptyState, Flash, Notice, PageHeader, cx } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { ALERT_CATEGORY, SEVERITY } from "@/lib/constants";
import { getNotifications, relevantAlerts } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Alerts and notifications" };

const TYPES = [
  { key: "all", label: "Everything" },
  { key: "safety", label: "Safety notices" },
  { key: "travel_guidance", label: "Travel guidance" },
  { key: "service_update", label: "Service updates" },
  { key: "crisis", label: "Crisis checks" },
  { key: "mine", label: "My cases and appointments" },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ type?: string; unread?: string; past?: string; notice?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireCitizen();
  const type = TYPES.some((t) => t.key === sp.type) ? sp.type! : "all";
  const [alerts, notifs] = await Promise.all([relevantAlerts(user.id, sp.past === "1"), getNotifications(user.id)]);

  type Item = { at: Date; kind: "alert" | "notice"; node: React.ReactNode; unread: boolean };
  const items: Item[] = [];
  if (type !== "mine") for (const a of alerts) if (type === "all" || a.category === type) items.push({ at: a.publishedAt ?? a.createdAt, kind: "alert", unread: !a.readAt, node: <AlertCard key={a.id} alert={a} /> });
  if (type === "all" || type === "mine" || type === "crisis") {
    for (const n of notifs) {
      if (type === "crisis" && n.kind !== "crisis") continue;
      if (type === "all" && n.kind === "crisis") continue; // crisis checks are shown through their alert
      items.push({
        at: n.createdAt,
        kind: "notice",
        unread: !n.readAt,
        node: (
          <article key={n.id} className={cx("rounded-2xl border bg-white p-4 shadow-sm", n.readAt ? "border-navy-100" : "border-l-4 border-navy-200 border-l-gold-500")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={SEVERITY[n.severity].tone}>{n.kind === "case" ? "Case update" : n.kind === "appointment" ? "Appointment" : n.kind === "crisis" ? "Wellbeing check" : n.kind === "trip" ? "Trip receipt" : "Notice"}</Badge>
              {!n.readAt && <Badge tone="gold">Unread</Badge>}
              <span className="text-xs text-navy-600">{fmtDateTime(n.createdAt)}</span>
            </div>
            <h3 className="mt-2 font-semibold text-navy-950">{n.title}</h3>
            <p className="text-navy-800">{n.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {n.href && <Link href={n.href} className="inline-flex min-h-9 items-center rounded-lg border border-navy-300 bg-white px-3 text-sm font-semibold text-navy-900 hover:bg-navy-50">Open</Link>}
              {!n.readAt && <ActionButton action={markNotificationRead.bind(null, n.id)}>Mark as read</ActionButton>}
            </div>
          </article>
        ),
      });
    }
  }
  const shown = items.filter((i) => (sp.unread === "1" ? i.unread : true)).sort((a, b) => b.at.getTime() - a.at.getTime());
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { type: type === "all" ? undefined : type, unread: sp.unread, past: sp.past, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/app/alerts${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Flash notice={sp.notice} />
      <PageHeader title="Alerts and notifications" description="Verified messages from your embassy for the places you are registered, plus updates on your cases and appointments." actions={<ActionButton variant="outline" size="md" action={markAllRead}>Mark all as read</ActionButton>} />
      <Notice tone="info" className="mb-5" title="Delivery is simulated in this demo">Alerts are shown here. Email, SMS and push delivery is not connected to a real provider. Choose your channels in <Link className="underline" href="/app/profile#notifications">notification settings</Link>.</Notice>
      <nav aria-label="Filter alerts" className="mb-4 flex flex-wrap gap-2">
        {TYPES.map((t) => <Link key={t.key} href={q({ type: t.key === "all" ? undefined : t.key })} aria-current={type === t.key ? "page" : undefined} className={cx("rounded-full border px-3 py-1.5 text-sm font-medium", type === t.key ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-800 hover:border-teal-600")}>{t.label}</Link>)}
      </nav>
      <div className="mb-5 flex flex-wrap gap-4 text-sm">
        <Link className="underline" href={q({ unread: sp.unread === "1" ? undefined : "1" })}>{sp.unread === "1" ? "Show read and unread" : "Show unread only"}</Link>
        <Link className="underline" href={q({ past: sp.past === "1" ? undefined : "1" })}>{sp.past === "1" ? "Hide expired alerts" : "Include expired alerts"}</Link>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nothing to show" icon="🔔">{alerts.length === 0 && notifs.length === 0 ? "You have no alerts yet. Register a trip to receive alerts for your destination." : "No items match your filters."}</EmptyState>
      ) : (
        <div className="space-y-3">{shown.map((i) => i.node)}</div>
      )}
      <Card className="mt-8 text-sm text-navy-700">Alert types: {Object.values(ALERT_CATEGORY).join(" · ")}. Official messages carry a “Verified” label and show when they were published and when they expire.</Card>
    </div>
  );
}
