import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, Flash, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { CASE_CATEGORIES, CASE_STATUS } from "@/lib/constants";
import { getLang, tr, type Key } from "@/lib/i18n";
import { getUserCases } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import type { CaseCategory } from "@/db/schema";

export const metadata: Metadata = { title: "Get help" };

export default async function HelpHub({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const lang = await getLang();
  const t = (k: Key) => tr(lang, k);
  const { user } = await requireCitizen();
  const cases = await getUserCases(user.id);
  return (
    <div className="mx-auto max-w-5xl">
      <Flash notice={notice} />
      <PageHeader title={t("help.title")} eyebrow="Consular assistance" description="Tell the embassy what you need. We'll show you the status of every request." />
      <div className="mb-6 rounded-2xl border-2 border-red-700 bg-red-50 p-5">
        <h2 className="text-xl font-bold text-red-950">{t("help.danger")}</h2>
        <p className="mt-1 text-red-950">{t("disclaimer")}</p>
        <div className="mt-3 flex flex-wrap gap-2"><ButtonLink href="/app/help/urgent" variant="danger" size="lg">{t("help.urgentBtn")}</ButtonLink></div>
      </div>

      <SectionTitle>{t("help.what")}</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(CASE_CATEGORIES) as CaseCategory[]).map((k) => (
          <li key={k}>
            <Link href={`/app/help/new?category=${k}`} className="flex h-full items-start gap-3 rounded-2xl border border-navy-200 bg-white p-4 shadow-sm transition hover:border-teal-600 hover:shadow-md">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-xl">{CASE_CATEGORIES[k].icon}</span>
              <span><span className="block font-semibold text-navy-950">{CASE_CATEGORIES[k].label}</span><span className="block text-sm text-navy-700">{CASE_CATEGORIES[k].description}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <Notice tone="info" className="mt-4" title="What to expect">Assistance depends on the embassy&apos;s real services and capabilities. We can&apos;t promise evacuation, financial support or an immediate response. See <Link className="underline" href="/guidance">consular guidance</Link> for what the embassy can and cannot do.</Notice>

      <Card className="mt-8">
        <SectionTitle>My requests</SectionTitle>
        {cases.length === 0 ? (
          <EmptyState title="No requests yet" icon="✉">When you submit a request you&apos;ll be able to follow its progress and message the embassy here.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-100">
            {cases.map(({ c, mission }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/app/cases/${c.id}`} className="font-semibold text-navy-950 underline decoration-navy-300 underline-offset-4 hover:decoration-teal-700">{CASE_CATEGORIES[c.category].label}</Link>
                  <p className="text-sm text-navy-600">{c.reference} · {mission} · submitted {fmtDateTime(c.createdAt)}</p>
                </div>
                <Badge tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
