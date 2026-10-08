import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { postCaseMessage } from "@/app/actions/citizen";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/form";
import { Badge, Card, DefList, Flash, Notice, PageHeader, SectionTitle, Timeline, cx } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { CASE_CATEGORIES, CASE_STATUS, EMERGENCY_DISCLAIMER, URGENCY } from "@/lib/constants";
import { getUserCase } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Request status" };

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { user } = await requireCitizen();
  const data = await getUserCase(user.id, id); // only the owner can load a case
  if (!data) notFound();
  const { c, mission, messages, events, attachments, assignee } = data;
  const st = CASE_STATUS[c.status];
  const pendingInfo = c.status === "awaiting_citizen" ? [...messages].reverse().find((m) => m.kind === "info_request") : null;
  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-2 text-sm"><Link href="/app/help" className="underline">← Get help</Link></p>
      <Flash notice={notice} />
      <PageHeader title={CASE_CATEGORIES[c.category].label} eyebrow={`Request ${c.reference}`} description={`Sent to ${mission.name}. Times in this thread are shown in UTC.`} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone={st.tone} className="px-3 py-1 text-sm">{st.label}</Badge>
        <span className="text-navy-700">{st.help}</span>
      </div>
      {c.status === "submitted" && <Notice tone="warning" className="mb-6" title="This is not a guarantee of an immediate response">{EMERGENCY_DISCLAIMER}</Notice>}
      {pendingInfo && (
        <Notice tone="gold" className="mb-6" title="The embassy needs information from you">
          <p className="whitespace-pre-line">{pendingInfo.body}</p>
          <p className="mt-1 text-sm">Reply in the message box below.</p>
        </Notice>
      )}
      {c.status === "resolved" && c.resolutionNote && (
        <Notice tone="success" className="mb-6" title={`Resolved ${fmtDateTime(c.resolvedAt)}`}><p className="whitespace-pre-line">{c.resolutionNote}</p><p className="mt-1 text-sm">Need more help? Submit a new request from “Get help”.</p></Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle>Your request</SectionTitle>
            <p className="whitespace-pre-line text-navy-900">{c.description}</p>
            <div className="mt-4"><DefList items={[
              { label: "Location", value: c.location },
              { label: "Urgency you chose", value: URGENCY[c.citizenUrgency] },
              { label: "Preferred contact", value: `${c.contactMethod}${c.contactDetail ? ` – ${c.contactDetail}` : ""}` },
              { label: "Submitted", value: fmtDateTime(c.createdAt) },
              { label: "Assigned team", value: assignee ? `Consular assistance team, ${mission.city}` : "Not assigned yet" },
              { label: "Attachments", value: attachments.length ? <ul>{attachments.map((a) => <li key={a.id}><a className="underline" href={`/api/attachments/${a.id}`}>{a.filename}</a> ({Math.ceil(a.sizeBytes / 1024)} KB)</li>)}</ul> : "None" },
            ]} /></div>
          </Card>

          <Card>
            <SectionTitle>Secure messages</SectionTitle>
            {messages.length === 0 ? <p className="text-navy-700">No messages yet. The embassy will reply here.</p> : (
              <ul className="space-y-3" aria-label="Message thread">
                {messages.map((m) => (
                  <li key={m.id} className={cx("max-w-[92%] rounded-2xl p-4", m.authorKind === "citizen" ? "ml-auto bg-teal-50" : "bg-navy-50", m.kind === "info_request" && "ring-2 ring-gold-400")}>
                    <p className="text-xs font-semibold text-navy-600">{m.authorKind === "citizen" ? "You" : `Embassy – ${mission.city}`} · {fmtDateTime(m.createdAt)} {m.kind === "info_request" && <Badge tone="gold">Information requested</Badge>}</p>
                    <p className="mt-1 whitespace-pre-line text-navy-950">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {c.status !== "resolved" ? (
              <ActionForm action={postCaseMessage.bind(null, id)} resetOnSuccess className="mt-5">
                <TextAreaField label={pendingInfo ? "Your reply" : "Send a message"} name="body" required maxLength={2000} rows={4} hint="Only you and the embassy can see this thread." />
                <SubmitButton variant="teal" pendingLabel="Sending…">Send message</SubmitButton>
              </ActionForm>
            ) : <p className="mt-4 text-sm text-navy-600">This request is closed. Messaging is disabled.</p>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <SectionTitle>Progress</SectionTitle>
            <Timeline items={events.map((e) => ({ id: e.id, at: fmtDateTime(e.createdAt), title: e.summary }))} />
          </Card>
          <Notice tone="info">This request is separate from your travel registration and wellbeing status. Updating one does not change the others.</Notice>
        </div>
      </div>
    </div>
  );
}
