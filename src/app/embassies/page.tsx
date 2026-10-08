import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public";
import { Badge, ButtonLink, Card, DemoNote, EmptyState, Notice } from "@/components/ui";
import { COUNTRIES, DIRECTORY_NOTE, FALLBACK_CONTACT, LOCAL_EMERGENCY } from "@/lib/constants";
import { listMissionsWithJurisdictions } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { ensureSeeded } from "@/lib/seed";

export const metadata: Metadata = { title: "Find an embassy" };
export const dynamic = "force-dynamic";

export default async function Embassies({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await ensureSeeded();
  const { q = "" } = await searchParams;
  const term = q.trim().toLowerCase();
  const all = await listMissionsWithJurisdictions();
  const servedCountries = [...new Set(all.flatMap((m) => m.jurisdictions.map((j) => j.country)))].sort();

  const matches = all.filter((m) => !term || [m.name, m.city, m.country, ...m.jurisdictions.flatMap((j) => [j.country, j.region ?? ""])].some((v) => v.toLowerCase().includes(term)));
  const exactCountry = COUNTRIES.find((c) => c.toLowerCase() === term) ?? servedCountries.find((c) => c.toLowerCase() === term);
  const responsible = exactCountry ? all.filter((m) => m.jurisdictions.some((j) => j.country === exactCountry)) : [];

  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-serif text-4xl font-semibold text-navy-950">Kenyan embassies, high commissions and consulates</h1>
        <p className="mt-2 max-w-2xl text-lg text-navy-700">Search by the country you&apos;re travelling to, a city, or a mission name. We&apos;ll show which Kenyan mission is responsible — even if it is based in another country.</p>
        <Notice tone="gold" className="mt-4" title="Pilot directory – details to be confirmed">{DIRECTORY_NOTE}</Notice>

        <form role="search" className="mt-6 flex flex-col gap-3 sm:flex-row" action="/embassies">
          <label htmlFor="q" className="sr-only">Search destination or mission</label>
          <input id="q" name="q" defaultValue={q} placeholder="e.g. Dubai, Nepal, London, California" className="min-h-12 flex-1 rounded-lg border border-navy-300 bg-white px-4 text-base" />
          <button className="min-h-12 rounded-lg bg-navy-900 px-6 font-semibold text-white hover:bg-navy-800">Search</button>
          {q && <Link href="/embassies" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-navy-300 bg-white px-5 font-semibold text-navy-900">Clear</Link>}
        </form>

        <details className="mt-4 rounded-xl border border-navy-100 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-navy-900">Browse all {servedCountries.length} countries served by Kenyan missions</summary>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Browse by destination">
            {servedCountries.map((c) => (
              <Link key={c} href={`/embassies?q=${encodeURIComponent(c)}`} className="rounded-full border border-navy-200 bg-white px-3 py-1 text-sm text-navy-800 hover:border-teal-600 hover:text-teal-800">{c}</Link>
            ))}
          </div>
        </details>

        {term && exactCountry && (
          <section className="mt-8" aria-live="polite">
            {responsible.length ? (
              responsible.map((m) => {
                const regionals = m.jurisdictions.filter((j) => j.country === exactCountry && j.region);
                const national = m.jurisdictions.some((j) => j.country === exactCountry && !j.region);
                return (
                  <Notice key={m.id} tone="info" title={`${exactCountry} → ${m.name}`}>
                    {m.country === exactCountry ? `Kenya has a mission in ${exactCountry}.` : `Kenya has no resident mission in ${exactCountry}. It is served from ${m.city}, ${m.country}.`}
                    {regionals.length > 0 && <> {national ? "Covers the whole country except regions served by another mission." : `Covers only: ${regionals.map((r) => r.region).join(", ")}.`}</>}
                  </Notice>
                );
              })
            ) : (
              <Notice tone="warning" title={`No mission covers ${exactCountry} in this demo`}>
                You can still travel, but there is no registration route here. In an emergency contact local services first{LOCAL_EMERGENCY[exactCountry] ? ` (${LOCAL_EMERGENCY[exactCountry]})` : ""}, then the fallback contact: {FALLBACK_CONTACT.name}, {FALLBACK_CONTACT.phone}<DemoNote />.
              </Notice>
            )}
          </section>
        )}

        <section className="mt-8" aria-label="Results">
          {matches.length === 0 ? (
            <EmptyState title="No missions found" icon="🔍" action={<ButtonLink href="/embassies" variant="outline">Show all missions</ButtonLink>}>
              Try a country name like “Portugal” or a city like “Rome”. Destinations without a mission are explained above when you search an exact country name.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {matches.map((m) => (
                <li key={m.id}>
                  <Card className="h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold text-navy-950"><Link className="underline decoration-navy-300 underline-offset-4 hover:decoration-teal-700" href={`/embassies/${m.id}`}>{m.name}</Link></h2>
                        <p className="text-sm text-navy-700">{m.city}, {m.country} · {m.timezone}</p>
                      </div>
                      <Badge tone="gold">Demo</Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium text-navy-600">Serves</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {[...new Set(m.jurisdictions.map((j) => (j.region ? `${j.country} (${j.region})` : j.country)))].map((s) => <li key={s}><Badge tone={s.startsWith(m.country) ? "navy" : "teal"}>{s}</Badge></li>)}
                    </ul>
                    <p className="mt-3 text-xs text-navy-600">Last verified {fmtDate(m.lastVerifiedAt)} · {m.services.length} services</p>
                    <div className="mt-4"><ButtonLink href={`/embassies/${m.id}`} variant="outline" size="sm">View details</ButtonLink></div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
