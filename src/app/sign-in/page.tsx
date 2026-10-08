import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { missions, users } from "@/db/schema";
import { createDemoAccount } from "@/app/actions/auth";
import { ActionForm, CheckField, SelectField, SubmitButton, TextField } from "@/components/form";
import { PublicFooter, PublicHeader } from "@/components/public";
import { Badge, Card, KenyaStripe, Notice, btn, cx } from "@/components/ui";
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

const AVATAR_BG = ["bg-ke-green", "bg-mfa-navy", "bg-ke-red", "bg-gold-500"];
const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function PersonaRow({ name, note, badge, userId, cta, i, staff }: { name: string; note: string; badge?: ReactNode; userId: string; cta: string; i: number; staff?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-100 bg-white p-3 transition hover:border-teal-600 hover:shadow-md sm:flex-nowrap">
      <span aria-hidden className={cx("flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", AVATAR_BG[i % AVATAR_BG.length])}>{initials(name)}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy-950">
          {name} {badge}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-navy-600">{note}</p>
      </div>
      <form action="/api/demo/sign-in" method="post" className="shrink-0">
        <input type="hidden" name="userId" value={userId} />
        <button className={btn(staff ? "outline" : i === 0 ? "teal" : "outline", "sm")}>{cta}</button>
      </form>
    </li>
  );
}

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
        {sp.reset && <div role="status" className="mb-6"><Notice tone="success">Demo data has been reset to its original sample state.</Notice></div>}
        {sp.error && <div role="alert" className="mb-6"><Notice tone="warning" title="That demo user is no longer available">The demo data was probably reset while this page was open. Please choose a persona from the list below.</Notice></div>}

        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_1fr]">
          {/* Brand panel */}
          <section className="on-dark relative overflow-hidden rounded-3xl bg-gradient-to-b from-ke-black via-mfa-navy to-navy-900 text-white shadow-xl">
            <div className="p-7 sm:p-10">
              <div className="flex items-center gap-5">
                <Image src="/mfa-logo.png" alt="Seal of the Ministry of Foreign Affairs, Republic of Kenya" width={1408} height={768} sizes="96px" className="h-16 w-auto sm:h-20" priority />
                <Image src="/kenya-coat-of-arms.png" alt="Coat of arms of the Republic of Kenya" width={1408} height={768} sizes="96px" className="h-16 w-auto sm:h-20" priority />
              </div>
              <p className="mt-7 inline-block rounded-full border border-gold-400/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold-300">Republic of Kenya · Ministry of Foreign Affairs</p>
              <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Karibu. <span className="text-gold-300">Your embassy,</span> with you abroad.
              </h1>
              <p className="mt-4 max-w-xl text-base text-navy-100">
                Register your travel, check in when you arrive, and get verified alerts and consular help when you need it. Choose a demo persona to explore the pilot.
              </p>
              <ul className="mt-7 grid max-w-xl gap-3 text-sm sm:grid-cols-2">
                {[
                  ["🧳", "Register a trip in minutes"],
                  ["✓", "Check in on arrival"],
                  ["🔔", "Verified embassy alerts"],
                  ["🤝", "Consular help & appointments"],
                ].map(([icon, label]) => (
                  <li key={label} className="flex items-center gap-3 rounded-xl border border-navy-600/70 bg-navy-900/60 px-3 py-2.5">
                    <span aria-hidden className="text-lg">{icon}</span>
                    <span className="font-medium text-navy-50">{label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-7 text-xs text-navy-200">
                Pilot prototype – sample data and simulated notifications. No passwords are requested or stored. Not yet operated by the Ministry.
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0"><KenyaStripe /></div>
          </section>

          {/* Access panel */}
          <section aria-labelledby="demo-access" className="space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 id="demo-access" className="font-serif text-2xl font-semibold text-navy-950">Demo access</h2>
              <p className="mt-1 text-sm text-navy-700">One click signs you in as a sample persona. Citizens land on their dashboard; staff on their mission portal.</p>

              <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-ke-green">Kenyan citizens</h3>
              <ul className="space-y-2.5">
                {ordered.map((u, i) => (
                  <PersonaRow key={u.id} i={i} name={u.displayName} note={CITIZEN_NOTES[u.displayName]} userId={u.id} cta={i === 0 ? "Start here" : "Continue"} badge={i === 0 ? <Badge tone="teal">Recommended</Badge> : undefined} />
                ))}
              </ul>

              <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-mfa-navy">Mission staff</h3>
              <p className="mb-2 text-xs text-navy-600">
                Try <strong>Mercy Atieno</strong> (consular officer, Dubai) for cases & the check-in map, <strong>Hassan Abdi</strong> (mission admin, Dubai) to publish alerts, or <strong>David Kamau</strong> (Ministry HQ) for aggregate reporting.
              </p>
              <ul className="space-y-2.5">
                {staffOrder.map(({ u, mission }, i) => (
                  <PersonaRow key={u.id} i={i + 1} staff name={u.displayName} note={mission ?? "All missions – aggregate data, audit and settings only"} userId={u.id} cta="Open staff portal" badge={<Badge tone={u.role === "platform_admin" ? "gold" : u.role === "mission_admin" ? "navy" : "teal"}>{ROLE_LABEL[u.role]}</Badge>} />
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="font-serif text-xl font-semibold text-navy-950">Create a demo citizen account</h2>
              <p className="mb-4 mt-1 text-sm text-navy-700">Use sample details. No passport or ID number, and no document upload, is required.</p>
              <ActionForm action={createDemoAccount}>
                <TextField label="Full name" name="fullName" required autoComplete="name" hint="As you'd like the embassy to address you." />
                <TextField label="Email" name="email" type="email" required autoComplete="email" hint="Used for confirmations and updates. Use a sample address." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Citizenship" name="citizenship" required hint="This pilot serves Kenyan citizens.">
                    <option>{HOME_COUNTRY}</option>
                  </SelectField>
                  <SelectField label="Preferred language" name="preferredLanguage" required hint="Used when the embassy writes to you.">{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</SelectField>
                </div>
                <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
                  <SelectField label="Dialling code" name="phoneDial" required defaultValue="+254">{DIAL_CODES.map((c) => <option key={c}>{c}</option>)}</SelectField>
                  <TextField label="Phone number" name="phoneNumber" type="tel" required autoComplete="tel-national" hint="So the embassy can reach you if you ask for help." />
                </div>
                <details className="group rounded-xl border border-navy-200 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-navy-900 marker:text-teal-700">Emergency contact & notification preferences (optional)</summary>
                  <div className="mt-3 space-y-4">
                    <TextField label="Emergency contact name" name="ecName" optional autoComplete="off" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Relationship" name="ecRelationship" optional />
                      <TextField label="Phone (with dialling code)" name="ecPhone" type="tel" optional />
                    </div>
                    <TextField label="Emergency contact email" name="ecEmail" type="email" optional />
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-semibold text-navy-900">How should we reach you? <span className="font-normal text-navy-600">(delivery is simulated)</span></legend>
                      <CheckField name="notifyEmail" label="Email" defaultChecked />
                      <CheckField name="notifySms" label="SMS" />
                      <CheckField name="notifyPush" label="Push notifications" />
                    </fieldset>
                  </div>
                </details>
                <SubmitButton variant="teal" size="lg" className="w-full" pendingLabel="Creating account…">Create demo account</SubmitButton>
              </ActionForm>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-white px-4 py-3">
              <p className="text-sm text-navy-700">Restores all sample data and removes accounts you created.</p>
              <form action="/api/demo/reset" method="post"><button className={btn("outline", "sm")}>Reset demo data</button></form>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
