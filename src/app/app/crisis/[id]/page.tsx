import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { respondCrisis, withdrawLocation } from "@/app/actions/citizen";
import { db } from "@/db";
import { crisisEvents, crisisResponses, missions } from "@/db/schema";
import { CrisisResponseForm } from "@/components/crisis-response-form";
import { ActionButton } from "@/components/form";
import { Badge, Card, Flash, Notice, PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { CRISIS_ANSWER, EMERGENCY_DISCLAIMER } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { UUID } from "@/lib/validation";

export const metadata: Metadata = { title: "Wellbeing check" };

export default async function CrisisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { user } = await requireCitizen();
  if (!UUID.test(id)) notFound();
  const [row] = await db
    .select({ r: crisisResponses, e: crisisEvents, m: missions })
    .from(crisisResponses)
    .innerJoin(crisisEvents, eq(crisisEvents.id, crisisResponses.crisisEventId))
    .innerJoin(missions, eq(missions.id, crisisEvents.missionId))
    .where(and(eq(crisisResponses.crisisEventId, id), eq(crisisResponses.userId, user.id)))
    .limit(1);
  if (!row) notFound();
  const { r, e, m } = row;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm"><Link href="/app/alerts" className="underline">← Alerts</Link></p>
      <Flash notice={notice} />
      <PageHeader title={e.title} eyebrow="Crisis wellbeing check" description={`From ${m.name} · sent ${fmtDateTime(e.sentAt, m.timezone)}`} />
      <Notice tone="gold" className="mb-4" title="✓ Verified message from the embassy">
        <p className="whitespace-pre-line">{e.message}</p>
      </Notice>
      <Notice tone="info" className="mb-6" title="Responding is voluntary">If you don&apos;t reply, the embassy will <strong>not</strong> assume you are missing, injured or in danger. {EMERGENCY_DISCLAIMER}</Notice>
      {e.status === "closed" ? (
        <Notice tone="info" title="This wellbeing check is closed">{r.response ? `Your response was “${CRISIS_ANSWER[r.response].label}”.` : "No response was recorded, and none is needed."}</Notice>
      ) : (
        <Card>
          {r.response && <p className="mb-4 text-navy-800">Your current response: <Badge tone={CRISIS_ANSWER[r.response].tone}>{CRISIS_ANSWER[r.response].label}</Badge> <span className="text-sm text-navy-600">· {fmtDateTime(r.respondedAt)}. You can change it below.</span></p>}
          <CrisisResponseForm action={respondCrisis.bind(null, id)} requestLocation={e.requestLocation} initial={{ response: r.response ?? "", note: r.note ?? "", location: r.locationText ?? "" }} />
          {r.locationText && (
            <div className="mt-6 rounded-xl border border-navy-200 p-4">
              <p className="font-semibold text-navy-950">Location you shared for this request</p>
              <p className="text-navy-800">{r.locationText}</p>
              <p className="mb-2 text-sm text-navy-600">Consent given {fmtDateTime(r.locationConsentAt)}.</p>
              <ActionButton variant="outline" action={withdrawLocation.bind(null, id)}>Withdraw my shared location</ActionButton>
            </div>
          )}
          {r.locationRevokedAt && !r.locationText && <p className="mt-4 text-sm text-navy-600">Your shared location was withdrawn on {fmtDateTime(r.locationRevokedAt)}.</p>}
        </Card>
      )}
    </div>
  );
}
