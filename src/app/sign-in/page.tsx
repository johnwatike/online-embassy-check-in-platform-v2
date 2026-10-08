import type { Metadata } from "next";
import Image from "next/image";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { missions, users } from "@/db/schema";
import { createDemoAccount } from "@/app/actions/auth";
import { ActionForm, CheckField, SelectField, SubmitButton, TextField } from "@/components/form";
import { PublicFooter, PublicHeader } from "@/components/public";
import { Badge, Card, DemoNotice, Notice, btn } from "@/components/ui";
import { DIAL_CODES, HOME_COUNTRY, LANGUAGES, ROLE_LABEL } from "@/lib/constants";
import { ensureSeeded } from "@/lib/seed";

export const metadata: Metadata = { title: "Sign in (demo)" };
export const dynamic = "force-dynamic";

const CITIZEN_NOTES: Record<string, string> = {
  "Wanjiku Mwangi": "On holiday in Dubai · stolen-passport case waiting for her reply · emergency travel document appointment booked · flood wellbeing check pending · upcoming trip to Norway (served from Stockholm)",
  "Faith Wambui": "Domestic worker in Riyadh · confidential labour-and-welfare case in progress, handled with safe-contact rules · prefers Kiswahili",
  "Brian Otieno": "In Dubai · answered the flood wellbeing check with “I need help” and shared his location by consent",
  "Achieng Odhiambo": "Work trip South Africa → Lesotho (Lesotho is served from Pretoria) · two registered dependants",
  "Kipchoge Rotich": "In Los Angeles – served by the Consulate General, not the Embassy in Washington · medical case in progress",
  "Grace Njeri": "In Malta, where Kenya has no resident mission – served from Rome",
  "Daniel Kiprop": "Student in Tokyo · resolved case and past appointment",
  "Amani Juma": "Upcoming business trip to Guangzhou (served from Beijing) · prefers Kiswahili",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reset?: string; error?: string }> }) {
  await ensureSeeded();
  const sp = await searchParams;
  const citizens = await db.select().from(users).where(inArray(users.displayName, Object.keys(CITIZEN_NOTES))).orderBy(asc(users.displayName));
  const staff = await db
    .select({ u: users, mission: missions.name })
    .from(users)
    .leftJoin(missions, eq(missions.id, users.missionId))
    .where(and(ne(users.role, "citizen"), eq(users.isDemo, true)))
    .orderBy(asc(users.role), asc(users.displayName));
  const first = (name: string) => (a: { displayName: string }, b: { displayName: string }) => (a.displayName === name ? -1 : b.displayName === name ? 1 : 0);
  const ordered = [...citizens].sort(first("Wanjiku Mwangi"));
  const staffOrder = [...staff].sort((a, b) => first("Mercy Atieno")(a.u, b.u));

  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-4">
          <Image src="/mfa-logo.png" alt="Seal of the Ministry of Foreign Affairs, Republic of Kenya" width={1408} height={768} sizes="96px" className="h-14 w-auto" />
          <h1 className="font-serif text-4xl font-semibold text-navy-950">Demo access</h1>
        </div>
        <p className="mt-2 max-w-3xl text-lg text-navy-700">Choose a sample persona or create a demo citizen account. No password is asked for or stored, and sessions are demo-only.</p>
        {sp.reset && <div role="status" className="mt-4"><Notice tone="success">Demo data has been reset to its original sample state.</Notice></div>}
        {sp.error && <div role="alert" className="mt-4"><Notice tone="warning" title="That demo user is no longer available">The demo data was probably reset while this page was open. Please choose a persona from the list below.</Notice></div>}
        <DemoNotice className="mt-4" />

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <section aria-labelledby="citizens">
              <h2 id="citizens" className="mb-3 text-xl font-semibold text-navy-950">Kenyan citizen demos</h2>
              <ul className="space-y-3">
                {ordered.map((u, i) => (
                  <li key={u.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-950">{u.displayName} {i === 0 && <Badge tone="teal">Start here</Badge>}</p>
                        <p className="text-sm text-navy-700">{CITIZEN_NOTES[u.displayName]}</p>
                      </div>
                      <form action="/api/demo/sign-in" method="post">
                        <input type="hidden" name="userId" value={u.id} />
                        <button className={btn(i === 0 ? "teal" : "outline", "md")}>Continue as {u.displayName.split(" ")[0]}</button>
                      </form>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="staff">
              <h2 id="staff" className="mb-1 text-xl font-semibold text-navy-950">Mission staff demos</h2>
              <p className="mb-3 text-sm text-navy-700">Staff see only records for their own mission. In production, staff would sign in with single sign-on and multi-factor authentication — <strong>not implemented in this demo</strong>. Switching persona is for demonstration, not real access control. Try <strong>Mercy Atieno</strong> (consular officer, Dubai) to work cases, <strong>Hassan Abdi</strong> (mission administrator, Dubai) to publish alerts and send wellbeing checks, and <strong>David Kamau</strong> (Ministry HQ) for aggregate reporting.</p>
              <ul className="space-y-3">
                {staffOrder.map(({ u, mission }) => (
                  <li key={u.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-950">{u.displayName} <Badge tone={u.role === "platform_admin" ? "gold" : u.role === "mission_admin" ? "navy" : "teal"}>{ROLE_LABEL[u.role]}</Badge></p>
                        <p className="text-sm text-navy-700">{mission ?? "All missions – aggregate data, audit and settings only; no access to individual citizen records"}</p>
                      </div>
                      <form action="/api/demo/sign-in" method="post">
                        <input type="hidden" name="userId" value={u.id} />
                        <button className={btn("outline", "md")}>Open staff portal</button>
                      </form>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="create">
            <Card>
              <h2 id="create" className="text-xl font-semibold text-navy-950">Create a demo citizen account</h2>
              <p className="mb-4 mt-1 text-sm text-navy-700">Use sample details. We only ask for what the service needs. No passport or ID number, and no document upload, is required.</p>
              <ActionForm action={createDemoAccount}>
                <TextField label="Full name" name="fullName" required autoComplete="name" hint="As you'd like the embassy to address you." />
                <TextField label="Email" name="email" type="email" required autoComplete="email" hint="Used for confirmations and updates. Use a sample address." />
                <SelectField label="Citizenship" name="citizenship" required hint="This pilot serves Kenyan citizens.">
                  <option>{HOME_COUNTRY}</option>
                </SelectField>
                <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
                  <SelectField label="Dialling code" name="phoneDial" required defaultValue="+254">{DIAL_CODES.map((c) => <option key={c}>{c}</option>)}</SelectField>
                  <TextField label="Phone number" name="phoneNumber" type="tel" required autoComplete="tel-national" hint="So the embassy can reach you if you ask for help." />
                </div>
                <SelectField label="Preferred language" name="preferredLanguage" required hint="Used when the embassy writes to you. The interface switch (EN | SW) is at the top of the page.">{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</SelectField>
                <fieldset className="space-y-3 rounded-xl border border-navy-200 p-4">
                  <legend className="px-1 text-sm font-semibold text-navy-900">Emergency contact <span className="font-normal text-navy-600">(optional)</span></legend>
                  <p className="text-sm text-navy-600">Only used if you ask the embassy to contact someone. We never share your status or location with them automatically.</p>
                  <TextField label="Name" name="ecName" optional autoComplete="off" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Relationship" name="ecRelationship" optional />
                    <TextField label="Phone (with dialling code)" name="ecPhone" type="tel" optional />
                  </div>
                  <TextField label="Email" name="ecEmail" type="email" optional />
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-navy-900">How should we reach you? <span className="font-normal text-navy-600">(delivery is simulated in this demo)</span></legend>
                  <CheckField name="notifyEmail" label="Email" defaultChecked />
                  <CheckField name="notifySms" label="SMS" />
                  <CheckField name="notifyPush" label="Push notifications" />
                </fieldset>
                <SubmitButton variant="teal" size="lg" className="w-full" pendingLabel="Creating account…">Create demo account</SubmitButton>
              </ActionForm>
            </Card>
          </section>
        </div>

        <section className="mt-10 rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-semibold text-navy-950">Reset the demo</h2>
          <p className="text-sm text-navy-700">Restores all sample data (and removes accounts you created).</p>
          <form action="/api/demo/reset" method="post" className="mt-3"><button className={btn("outline", "sm")}>Reset demo data</button></form>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
