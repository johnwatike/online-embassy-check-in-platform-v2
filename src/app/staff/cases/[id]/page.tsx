import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { addInternalNote, requestInfo, resolveCase, staffReply, triageCase } from "@/app/actions/staff";
import { db } from "@/db";
import { assistanceCases, caseAttachments, caseEvents, caseMessages, caseNotes, citizenProfiles, trips, users } from "@/db/schema";
import { ActionForm, RadioCards, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { AccessDenied } from "@/components/staff-bits";
import { Badge, Card, DefList, Notice, PageHeader, SectionTitle, Timeline, cx } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CASE_CATEGORIES, CASE_STATUS, PRIORITY, URGENCY, can } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { audit } from "@/lib/services";
import { missionOfficers } from "@/lib/staff-data";
import { UUID } from "@/lib/validation";

export const metadata: Metadata = { title: "Case" };

export default async function StaffCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  await searchParams;
  const { user } = await requireStaff();
  if (!can(user.role, "cases.manage")) return <AccessDenied permission="cases.manage" role={user.role} />;
  if (!UUID.test(id)) notFound();
  const [row] = await db
    .select({ c: assistanceCases, p: citizenProfiles, email: users.email })
    .from(assistanceCases)
    .innerJoin(citizenProfiles, eq(citizenProfiles.userId, assistanceCases.userId))
    .innerJoin(users, eq(users.id, assistanceCases.userId))
    .where(and(eq(assistanceCases.id, id), eq(assistanceCases.missionId, user.missionId!))) // jurisdiction scope
    .limit(1);
  if (!row) notFound();
  const { c, p } = row;
  const [messages, notes, events, attachments, officers, tripRow] = await Promise.all([
    db.select({ m: caseMessages, name: users.displayName }).from(caseMessages).leftJoin(users, eq(users.id, caseMessages.authorId)).where(eq(caseMessages.caseId, id)).orderBy(asc(caseMessages.createdAt)),
    db.select({ n: caseNotes, name: users.displayName }).from(caseNotes).leftJoin(users, eq(users.id, caseNotes.authorId)).where(eq(caseNotes.caseId, id)).orderBy(desc(caseNotes.createdAt)),
    db.select({ e: caseEvents, name: users.displayName }).from(caseEvents).leftJoin(users, eq(users.id, caseEvents.actorId)).where(eq(caseEvents.caseId, id)).orderBy(desc(caseEvents.createdAt)),
    db.select({ id: caseAttachments.id, filename: caseAttachments.filename, sizeBytes: caseAttachments.sizeBytes }).from(caseAttachments).where(eq(caseAttachments.caseId, id)),
    missionOfficers(user.missionId!),
    c.tripId ? db.select().from(trips).where(eq(trips.id, c.tripId)).limit(1) : Promise.resolve([]),
  ]);
  await audit(user, "case.view", "case", id, `Case ${c.reference} opened`);
  const resolved = c.status === "resolved";

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-sm"><Link href="/staff/cases" className="underline">← Cases</Link></p>
      <PageHeader title={CASE_CATEGORIES[c.category].label} eyebrow={`Case ${c.reference}`} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={PRIORITY[c.priority].tone}>{PRIORITY[c.priority].label} priority</Badge>
        <Badge tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</Badge>
        {c.citizenUrgency === "urgent" && <Badge tone="red">Citizen marked urgent</Badge>}
        <span className="text-sm text-navy-600">Submitted {fmtDateTime(c.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle>Request</SectionTitle>
            <p className="whitespace-pre-line text-navy-950">{c.description}</p>
            <div className="mt-4"><DefList items={[
              { label: "Citizen", value: <>{p.fullName}<br /><span className="text-sm text-navy-600">{row.email} · {p.phoneDial} {p.phoneNumber} · {p.preferredLanguage}</span></> },
              { label: "Location given", value: c.location },
              { label: "Preferred contact", value: `${c.contactMethod}${c.contactDetail ? ` – ${c.contactDetail}` : ""}` },
              { label: "Urgency chosen by citizen", value: URGENCY[c.citizenUrgency] },
              { label: "Linked trip", value: tripRow[0] ? `${tripRow[0].reference} (${tripRow[0].status})${tripRow[0].wellbeingStatus ? ` · wellbeing: ${tripRow[0].wellbeingStatus.replace("_", " ")}` : ""}` : "None" },
              { label: "Attachments", value: attachments.length ? <ul>{attachments.map((a) => <li key={a.id}><a className="underline" href={`/api/attachments/${a.id}`}>{a.filename}</a> ({Math.ceil(a.sizeBytes / 1024)} KB)</li>)}</ul> : "None" },
            ]} /></div>
            <p className="mt-3 text-xs text-navy-600">Travel wellbeing status is separate from this case. A “safe” update does not resolve it.</p>
          </Card>

          <Card>
            <SectionTitle>Conversation with the citizen <Badge tone="teal">Visible to citizen</Badge></SectionTitle>
            {messages.length === 0 ? <p className="text-sm text-navy-700">No messages yet.</p> : (
              <ul className="mb-4 space-y-3">
                {messages.map(({ m, name }) => (
                  <li key={m.id} className={cx("max-w-[92%] rounded-2xl p-4", m.authorKind === "citizen" ? "bg-navy-50" : "ml-auto bg-teal-50", m.kind === "info_request" && "ring-2 ring-gold-400")}>
                    <p className="text-xs font-semibold text-navy-600">{m.authorKind === "citizen" ? p.fullName : name ?? "Staff"} · {fmtDateTime(m.createdAt)} {m.kind === "info_request" && <Badge tone="gold">Information request</Badge>}</p>
                    <p className="mt-1 whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              <ActionForm action={staffReply.bind(null, id)} resetOnSuccess>
                <TextAreaField label="Reply to the citizen" name="body" required maxLength={2000} rows={4} hint="Plain language. Do not promise evacuation, financial help or a response time." />
                <SubmitButton variant="teal" pendingLabel="Sending…">Send reply</SubmitButton>
              </ActionForm>
              <ActionForm action={requestInfo.bind(null, id)} resetOnSuccess>
                <TextAreaField label="Request information" name="body" required maxLength={1500} rows={4} hint="Sets the status to “Awaiting your response” and highlights the request for the citizen." />
                <SubmitButton variant="outline" pendingLabel="Sending…">Send information request</SubmitButton>
              </ActionForm>
            </div>
          </Card>

          <Card className="border-2 border-amber-400 bg-amber-50/50">
            <SectionTitle>Internal notes <Badge tone="amber">Staff only – never shown to the citizen</Badge></SectionTitle>
            {notes.length === 0 ? <p className="mb-4 text-sm text-navy-700">No internal notes yet.</p> : (
              <ul className="mb-4 space-y-2">{notes.map(({ n, name }) => <li key={n.id} className="rounded-xl bg-white p-3"><p className="text-xs font-semibold text-navy-600">{name} · {fmtDateTime(n.createdAt)}</p><p className="whitespace-pre-line">{n.body}</p></li>)}</ul>
            )}
            <ActionForm action={addInternalNote.bind(null, id)} resetOnSuccess>
              <TextAreaField label="Add an internal note" name="body" required maxLength={2000} rows={3} hint="Avoid unnecessary personal details. Notes are covered by the audit log." />
              <SubmitButton variant="outline" pendingLabel="Saving…">Save internal note</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Triage</SectionTitle>
            <ActionForm action={triageCase.bind(null, id)}>
              <SelectField label="Priority" name="priority" defaultValue={c.priority}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</SelectField>
              <SelectField label="Assigned officer" name="assigneeId" defaultValue={c.assignedToId ?? ""}>
                <option value="">Unassigned</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SelectField>
              <SelectField label="Status" name="status" defaultValue={resolved ? "in_progress" : c.status} hint={resolved ? "Changing status reopens this case." : "Use “Resolve” below to close the case."}>
                {Object.entries(CASE_STATUS).filter(([k]) => k !== "resolved").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </SelectField>
              <SubmitButton variant="primary" pendingLabel="Saving…">{resolved ? "Reopen case" : "Save triage"}</SubmitButton>
            </ActionForm>
          </Card>

          {!resolved ? (
            <Card>
              <SectionTitle>Resolve case</SectionTitle>
              <ActionForm action={resolveCase.bind(null, id)}>
                <TextAreaField label="Resolution note (shown to citizen)" name="resolutionNote" required maxLength={1500} rows={4} />
                <SubmitButton variant="teal" pendingLabel="Resolving…">Resolve case</SubmitButton>
              </ActionForm>
            </Card>
          ) : (
            <Notice tone="success" title="Resolved">{c.resolutionNote}</Notice>
          )}

          <Card>
            <SectionTitle>Activity history</SectionTitle>
            <Timeline items={events.map(({ e, name }) => ({ id: e.id, at: fmtDateTime(e.createdAt), title: e.summary, detail: name ? `by ${name}` : undefined, tag: e.citizenVisible ? undefined : <Badge tone="amber">Internal</Badge> }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}
