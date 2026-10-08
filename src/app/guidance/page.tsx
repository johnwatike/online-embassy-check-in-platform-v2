import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/public";
import { Badge, ButtonLink, Card, Notice } from "@/components/ui";
import { EMERGENCY_DISCLAIMER, GUIDANCE } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Consular guidance" };

export default function GuidancePage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-serif text-4xl font-semibold text-navy-950">Consular guidance</h1>
        <p className="mt-2 text-lg text-navy-700">Plain-language help for common situations abroad. Each article shows when it was last reviewed.</p>
        <Notice tone="danger" className="mt-4" title="In immediate danger?">{EMERGENCY_DISCLAIMER}</Notice>
        <nav aria-label="Guidance topics" className="mt-6 flex flex-wrap gap-2">
          {GUIDANCE.map((g) => <a key={g.id} href={`#${g.id}`} className="rounded-full border border-navy-200 bg-white px-3 py-1 text-sm text-navy-800 hover:border-teal-600">{g.title}</a>)}
        </nav>
        <div className="mt-8 space-y-6">
          {GUIDANCE.map((g) => (
            <Card key={g.id} id={g.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-navy-950">{g.title}</h2>
                <Badge tone="teal">Last updated {fmtDate(g.updated)}</Badge>
              </div>
              <p className="mt-1 text-navy-700">{g.summary}</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-navy-900">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              {g.note && <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-800">{g.note}</p>}
            </Card>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonLink href="/app/help" variant="teal">Request assistance</ButtonLink>
          <ButtonLink href="/embassies" variant="outline">Find an embassy</ButtonLink>
        </div>
        <p className="mt-6 text-xs text-navy-600">Demo content. Real guidance must be reviewed and dated by the responsible mission.</p>
      </main>
      <PublicFooter />
    </>
  );
}
