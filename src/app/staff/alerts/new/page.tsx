import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { saveAlert } from "@/app/actions/staff";
import { db } from "@/db";
import { missionJurisdictions } from "@/db/schema";
import { AlertForm } from "@/components/staff-forms";
import { AccessDenied } from "@/components/staff-bits";
import { Card, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/constants";

export const metadata: Metadata = { title: "New alert" };

export default async function NewAlert() {
  const { user } = await requireStaff();
  if (!can(user.role, "alerts.draft")) return <AccessDenied permission="alerts.draft" role={user.role} />;
  const juris = await db.select().from(missionJurisdictions).where(eq(missionJurisdictions.missionId, user.missionId!));
  const countries = [...new Set(juris.map((j) => j.country))].sort();
  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-sm"><Link href="/staff/alerts" className="underline">← Alerts</Link></p>
      <PageHeader title="New alert" description="Write the alert, check the preview and the number of intended recipients, then save a draft or publish." />
      <Card><AlertForm countries={countries} canPublish={can(user.role, "alerts.publish")} action={saveAlert} /></Card>
    </div>
  );
}
