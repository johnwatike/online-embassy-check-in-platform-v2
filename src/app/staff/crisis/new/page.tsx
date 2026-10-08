import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { createCrisis } from "@/app/actions/staff";
import { db } from "@/db";
import { missionJurisdictions } from "@/db/schema";
import { CrisisForm } from "@/components/staff-forms";
import { AccessDenied } from "@/components/staff-bits";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/constants";

export const metadata: Metadata = { title: "New wellbeing check" };

export default async function NewCrisis() {
  const { user } = await requireStaff();
  if (!can(user.role, "crisis.manage")) return <AccessDenied permission="crisis.manage" role={user.role} />;
  const juris = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, user.missionId!));
  const countries = [...new Set(juris.map((j) => j.country))].sort();
  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-sm"><Link href="/staff/crisis" className="underline">← Crisis checks</Link></p>
      <PageHeader title="New crisis wellbeing check" description="Ask citizens in an affected area to confirm they are safe." />
      <Notice tone="warning" className="mb-5" title="Principles">Replying is voluntary. A non-response must never be treated as evidence that someone is missing or injured. Location sharing is optional, explicit and specific to this request.</Notice>
      <Card><CrisisForm countries={countries} action={createCrisis} /></Card>
    </div>
  );
}
