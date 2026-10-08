import type { Metadata } from "next";
import { postWellbeing } from "@/app/actions/citizen";
import { WellbeingBadge, tripTitle } from "@/components/citizen-bits";
import { StatusForm } from "@/components/status-form";
import { ButtonLink, Card, EmptyState, Notice, PageHeader, SectionTitle, Timeline } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { WELLBEING } from "@/lib/constants";
import { getUserTrips, getWellbeingHistory, pickCurrentTrip } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getLang, tr, type Key } from "@/lib/i18n";

export const metadata: Metadata = { title: "Update my status" };

export default async function StatusPage() {
  const { user } = await requireCitizen();
  const lang = await getLang();
  const t = (k: Key) => tr(lang, k);
  const [all, history] = await Promise.all([getUserTrips(user.id), getWellbeingHistory(user.id)]);
  const trips = all.filter((tr0) => tr0.status === "active" || tr0.status === "planned");
  const current = pickCurrentTrip(all);
  const options = (Object.keys(WELLBEING) as (keyof typeof WELLBEING)[]).map((k) => ({
    value: k,
    label: t(`status.${k}` as Key),
    description: t(`status.${k}D` as Key),
    icon: WELLBEING[k].icon,
  }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("status.title")} eyebrow="Wellbeing" description={t("status.desc")} />
      <Notice tone="info" className="mb-6" title="You're in control">Updates are optional. If you don&apos;t send one, the embassy will <strong>not</strong> assume you are missing or in danger. Wellbeing updates never close or change an assistance request.</Notice>
      {trips.length === 0 ? (
        <EmptyState title="You need an active or upcoming trip first" icon="🧳" action={<ButtonLink href="/app/trips/new" variant="teal">Check in for a trip</ButtonLink>}>Register where you are, then you can update your status here.</EmptyState>
      ) : (
        <Card>
          <StatusForm action={postWellbeing} defaultTripId={current?.id ?? trips[0].id} options={options} question={t("status.question")} trips={trips.map((tp) => ({ id: tp.id, status: tp.status, label: `${tripTitle(tp)} · ${tp.reference}` }))} />
        </Card>
      )}
      <Card className="mt-6">
        <SectionTitle>Status history</SectionTitle>
        <Timeline items={history.map(({ w, ref }) => ({ id: w.id, at: fmtDateTime(w.createdAt), title: "", detail: [ref ? `Trip ${ref}` : "", w.source === "crisis_response" ? "Reply to a wellbeing check" : "", w.note ?? ""].filter(Boolean).join(" · ") || undefined, tag: <WellbeingBadge status={w.status} /> }))} />
      </Card>
    </div>
  );
}
