import { randomUUID } from "crypto";
import { count, sql } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import * as s from "@/db/schema";
import { addDays, makeRef, zonedToUtc } from "./format";
import { geocodePlace } from "./geo";
import { resolveRouting } from "./routing";
import { findRecipients } from "./services";
import type { RoutingEntry } from "./types";

// SAMPLE DATA for a pilot prepared for Kenya's Ministry of Foreign Affairs.
// - Mission names, host cities, kinds and countries served follow the Ministry's published directory of missions.
// - All people, addresses, phone numbers, emails, websites and opening hours are FICTIONAL PLACEHOLDERS.
//   Phone numbers use the unassigned +000 prefix. The Ministry must confirm every mission detail before launch.

const g = globalThis as typeof globalThis & { __ecSeed?: Promise<void>; __ecSeeded?: boolean };

export async function ensureSeeded() {
  if (g.__ecSeeded) return;
  g.__ecSeed ??= (async () => {
    const [{ c }] = await db.select({ c: count() }).from(s.missions);
    if (c === 0) {
      await withTransaction(async (tx) => {
        const [{ c: c2 }] = await tx.select({ c: count() }).from(s.missions);
        if (c2 === 0) await seedAll(tx as unknown as typeof db);
      });
    }
    g.__ecSeeded = true;
  })().finally(() => {
    g.__ecSeed = undefined;
  });
  await g.__ecSeed;
}

export async function resetDemoData() {
  g.__ecSeeded = false;
  await db.run(sql`pragma foreign_keys = off`);
  try {
    for (const table of [
      s.feedback,
      s.auditEvents,
      s.crisisResponses,
      s.crisisEvents,
      s.appointments,
      s.caseEvents,
      s.caseNotes,
      s.caseMessages,
      s.caseAttachments,
      s.assistanceCases,
      s.notifications,
      s.alertReads,
      s.alerts,
      s.wellbeingUpdates,
      s.dependants,
      s.tripEvents,
      s.tripDestinations,
      s.trips,
      s.notificationPreferences,
      s.emergencyContacts,
      s.citizenProfiles,
      s.users,
      s.missionJurisdictions,
      s.missions,
    ]) {
      await db.delete(table);
    }
  } finally {
    await db.run(sql`pragma foreign_keys = on`);
  }
  await ensureSeeded();
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVICES: s.ServiceDef[] = [
  {
    id: "passport",
    name: "Passport application support",
    description: "Help with applying for, renewing or replacing a Kenyan passport while abroad.",
    documents: ["National ID card or birth certificate", "Previous passport, if you have one", "Passport photographs (to the Ministry's specification)", "Proof of your address in the host country", "Proof of payment, following the Ministry's current process"],
    durationMin: 30,
  },
  {
    id: "etd",
    name: "Emergency travel document",
    description: "A temporary document for a single journey home if your passport is lost, stolen or destroyed.",
    documents: ["Police report, if the passport was stolen", "Any copy or photo of your lost passport", "National ID card or birth certificate", "Two passport photographs", "Proof of travel plans (ticket or itinerary)"],
    durationMin: 30,
  },
  {
    id: "attest",
    name: "Document attestation and certification",
    description: "Certify copies, signatures or declarations for use in Kenya or abroad.",
    documents: ["Original documents to be certified", "Valid passport or national ID", "Any forms from the requesting organisation"],
    durationMin: 20,
  },
  {
    id: "civil",
    name: "Birth and death registration",
    description: "Register a birth or death that took place abroad for Kenyan records.",
    documents: ["Original local birth or death certificate", "Certified translation, if not in English", "Parents' or next of kin's identity documents"],
    durationMin: 30,
  },
  {
    id: "labour",
    name: "Labour and welfare advice",
    description: "Speak to a consular officer in confidence about problems at work, unpaid wages, housing or a held passport.",
    documents: ["Employment contract or job offer, if you have one", "Messages or payslips, if you have them", "Employer or agency details, if known"],
    durationMin: 30,
  },
  {
    id: "advice",
    name: "General consular advice",
    description: "Talk to a consular officer about services, living abroad or any question.",
    documents: ["Valid passport or national ID", "Any documents related to your question"],
    durationMin: 20,
  },
];

type Kind = "embassy" | "high_commission" | "consulate";
type Serve = [string, string | null];
type MissionDef = { key: string; kind: Kind; city: string; country: string; tz: string; serves: Serve[]; services: string[]; v: number };

const FULL = ["passport", "etd", "attest", "civil", "advice"];
const GULF = ["passport", "etd", "attest", "labour", "advice"];
const SMALL = ["passport", "etd", "advice"];
const one = (c: string): Serve[] => [[c, null]];
const many = (...c: string[]): Serve[] => c.map((x) => [x, null]);
const regions = (country: string, ...r: string[]): Serve[] => r.map((x) => [country, x]);

const MISSIONS: MissionDef[] = [
  // Europe
  { key: "lon", kind: "high_commission", city: "London", country: "United Kingdom", tz: "Europe/London", serves: one("United Kingdom"), services: FULL, v: 9 },
  { key: "ber", kind: "embassy", city: "Berlin", country: "Germany", tz: "Europe/Berlin", serves: one("Germany"), services: FULL, v: 21 },
  { key: "par", kind: "embassy", city: "Paris", country: "France", tz: "Europe/Paris", serves: one("France"), services: FULL, v: 33 },
  { key: "bru", kind: "embassy", city: "Brussels", country: "Belgium", tz: "Europe/Brussels", serves: one("Belgium"), services: SMALL, v: 18 },
  { key: "rom", kind: "embassy", city: "Rome", country: "Italy", tz: "Europe/Rome", serves: many("Italy", "Malta"), services: FULL, v: 5 },
  { key: "mad", kind: "embassy", city: "Madrid", country: "Spain", tz: "Europe/Madrid", serves: one("Spain"), services: SMALL, v: 40 },
  { key: "sto", kind: "embassy", city: "Stockholm", country: "Sweden", tz: "Europe/Stockholm", serves: many("Sweden", "Denmark", "Norway", "Finland", "Iceland", "Estonia", "Latvia", "Lithuania"), services: SMALL, v: 27 },
  { key: "dub", kind: "embassy", city: "Dublin", country: "Ireland", tz: "Europe/Dublin", serves: one("Ireland"), services: SMALL, v: 15 },
  { key: "hag", kind: "embassy", city: "The Hague", country: "Netherlands", tz: "Europe/Amsterdam", serves: one("Netherlands"), services: SMALL, v: 30 },
  { key: "vie", kind: "embassy", city: "Vienna", country: "Austria", tz: "Europe/Vienna", serves: one("Austria"), services: SMALL, v: 44 },
  { key: "brn", kind: "embassy", city: "Bern", country: "Switzerland", tz: "Europe/Zurich", serves: one("Switzerland"), services: SMALL, v: 36 },
  { key: "mow", kind: "embassy", city: "Moscow", country: "Russia", tz: "Europe/Moscow", serves: one("Russia"), services: SMALL, v: 50 },
  { key: "ank", kind: "embassy", city: "Ankara", country: "Turkey", tz: "Europe/Istanbul", serves: many("Turkey", "Bulgaria", "Georgia", "North Macedonia", "Romania"), services: SMALL, v: 23 },
  // Middle East
  { key: "auh", kind: "embassy", city: "Abu Dhabi", country: "United Arab Emirates", tz: "Asia/Dubai", serves: one("United Arab Emirates"), services: GULF, v: 7 },
  { key: "dxb", kind: "consulate", city: "Dubai", country: "United Arab Emirates", tz: "Asia/Dubai", serves: regions("United Arab Emirates", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"), services: GULF, v: 4 },
  { key: "ruh", kind: "embassy", city: "Riyadh", country: "Saudi Arabia", tz: "Asia/Riyadh", serves: one("Saudi Arabia"), services: GULF, v: 11 },
  { key: "doh", kind: "embassy", city: "Doha", country: "Qatar", tz: "Asia/Qatar", serves: one("Qatar"), services: GULF, v: 14 },
  { key: "kwi", kind: "embassy", city: "Kuwait City", country: "Kuwait", tz: "Asia/Kuwait", serves: one("Kuwait"), services: GULF, v: 26 },
  { key: "mct", kind: "embassy", city: "Muscat", country: "Oman", tz: "Asia/Muscat", serves: one("Oman"), services: GULF, v: 19 },
  { key: "cai", kind: "embassy", city: "Cairo", country: "Egypt", tz: "Africa/Cairo", serves: many("Egypt", "Eritrea", "Jordan", "Palestine"), services: SMALL, v: 31 },
  // Asia and Pacific
  { key: "pek", kind: "embassy", city: "Beijing", country: "China", tz: "Asia/Shanghai", serves: many("China", "Mongolia"), services: FULL, v: 12 },
  { key: "del", kind: "high_commission", city: "New Delhi", country: "India", tz: "Asia/Kolkata", serves: many("India", "Bangladesh", "Bhutan", "Maldives", "Nepal", "Singapore", "Sri Lanka"), services: FULL, v: 16 },
  { key: "nrt", kind: "embassy", city: "Tokyo", country: "Japan", tz: "Asia/Tokyo", serves: one("Japan"), services: FULL, v: 8 },
  { key: "sel", kind: "embassy", city: "Seoul", country: "South Korea", tz: "Asia/Seoul", serves: one("South Korea"), services: SMALL, v: 29 },
  { key: "bkk", kind: "embassy", city: "Bangkok", country: "Thailand", tz: "Asia/Bangkok", serves: many("Thailand", "Cambodia", "Laos", "Vietnam", "Myanmar"), services: SMALL, v: 24 },
  { key: "kul", kind: "high_commission", city: "Kuala Lumpur", country: "Malaysia", tz: "Asia/Kuala_Lumpur", serves: many("Malaysia", "Brunei"), services: SMALL, v: 38 },
  { key: "cgk", kind: "embassy", city: "Jakarta", country: "Indonesia", tz: "Asia/Jakarta", serves: one("Indonesia"), services: SMALL, v: 45 },
  { key: "isb", kind: "high_commission", city: "Islamabad", country: "Pakistan", tz: "Asia/Karachi", serves: one("Pakistan"), services: SMALL, v: 35 },
  { key: "cbr", kind: "high_commission", city: "Canberra", country: "Australia", tz: "Australia/Sydney", serves: many("Australia", "New Zealand", "Fiji", "Papua New Guinea", "Samoa", "Vanuatu", "Kiribati", "Nauru", "Timor-Leste"), services: FULL, v: 20 },
  // Americas
  { key: "dc", kind: "embassy", city: "Washington, D.C.", country: "United States", tz: "America/New_York", serves: many("United States", "Costa Rica", "El Salvador", "Honduras", "Nicaragua"), services: FULL, v: 6 },
  { key: "lax", kind: "consulate", city: "Los Angeles", country: "United States", tz: "America/Los_Angeles", serves: regions("United States", "California", "Nevada", "Arizona", "Oregon", "Seattle"), services: SMALL, v: 10 },
  { key: "nyc", kind: "consulate", city: "New York", country: "United States", tz: "America/New_York", serves: regions("United States", "New York", "New Jersey", "Connecticut", "Massachusetts", "Boston"), services: SMALL, v: 13 },
  { key: "ott", kind: "high_commission", city: "Ottawa", country: "Canada", tz: "America/Toronto", serves: one("Canada"), services: FULL, v: 17 },
  { key: "mex", kind: "embassy", city: "Mexico City", country: "Mexico", tz: "America/Mexico_City", serves: one("Mexico"), services: SMALL, v: 42 },
  { key: "bsb", kind: "embassy", city: "Brasília", country: "Brazil", tz: "America/Sao_Paulo", serves: many("Brazil", "Argentina", "Bolivia", "Chile", "Paraguay", "Peru", "Uruguay"), services: SMALL, v: 37 },
  // Africa
  { key: "pta", kind: "high_commission", city: "Pretoria", country: "South Africa", tz: "Africa/Johannesburg", serves: many("South Africa", "Eswatini", "Lesotho"), services: FULL, v: 3 },
  { key: "kla", kind: "high_commission", city: "Kampala", country: "Uganda", tz: "Africa/Kampala", serves: one("Uganda"), services: FULL, v: 22 },
  { key: "dar", kind: "high_commission", city: "Dar es Salaam", country: "Tanzania", tz: "Africa/Dar_es_Salaam", serves: [["Tanzania", null], ["Seychelles", null]], services: FULL, v: 25 },
  { key: "arh", kind: "consulate", city: "Arusha", country: "Tanzania", tz: "Africa/Dar_es_Salaam", serves: regions("Tanzania", "Arusha", "Kilimanjaro", "Manyara", "Moshi"), services: SMALL, v: 32 },
  { key: "kgl", kind: "high_commission", city: "Kigali", country: "Rwanda", tz: "Africa/Kigali", serves: one("Rwanda"), services: SMALL, v: 28 },
  { key: "add", kind: "embassy", city: "Addis Ababa", country: "Ethiopia", tz: "Africa/Addis_Ababa", serves: one("Ethiopia"), services: FULL, v: 14 },
  { key: "abv", kind: "high_commission", city: "Abuja", country: "Nigeria", tz: "Africa/Lagos", serves: many("Nigeria", "Benin", "Cameroon", "Equatorial Guinea", "Guinea", "Liberia", "Sierra Leone", "Togo"), services: SMALL, v: 34 },
  { key: "acc", kind: "high_commission", city: "Accra", country: "Ghana", tz: "Africa/Accra", serves: many("Ghana", "Burkina Faso"), services: SMALL, v: 39 },
  { key: "lun", kind: "high_commission", city: "Lusaka", country: "Zambia", tz: "Africa/Lusaka", serves: many("Zambia", "Malawi"), services: SMALL, v: 41 },
  { key: "hre", kind: "embassy", city: "Harare", country: "Zimbabwe", tz: "Africa/Harare", serves: one("Zimbabwe"), services: SMALL, v: 46 },
  { key: "jub", kind: "embassy", city: "Juba", country: "South Sudan", tz: "Africa/Juba", serves: one("South Sudan"), services: SMALL, v: 48 },
  { key: "mgq", kind: "embassy", city: "Mogadishu", country: "Somalia", tz: "Africa/Mogadishu", serves: one("Somalia"), services: SMALL, v: 47 },
];

const FIRST = ["Akinyi", "Amina", "Baraka", "Chebet", "Daudi", "Esther", "Faraja", "Gathoni", "Halima", "Imani", "Juma", "Kamau", "Lydia", "Mumbi", "Njeri", "Otieno", "Rehema", "Salim", "Tabitha", "Wafula", "Zawadi", "Naliaka", "Kiprono", "Wambui", "Mutiso", "Anyango"];
const LAST = ["Abdi", "Wanjala", "Kamau", "Mutua", "Njoroge", "Ochieng", "Kiptoo", "Mwangi", "Omondi", "Wekesa", "Nyambura", "Karanja", "Chepkoech", "Mohamed", "Barasa", "Kimani", "Okello", "Maina", "Kariuki", "Muriuki", "Langat", "Mwende", "Owino", "Cheruiyot"];

// Weighted by where Kenyans commonly live and travel (some entries repeated on purpose).
const BULK_DESTS: { country: string; regions: string[] }[] = [
  { country: "United Arab Emirates", regions: ["Dubai", "Dubai, Jumeirah", "Dubai, Business Bay", "Abu Dhabi", "Abu Dhabi, Khalifa City", "Sharjah"] },
  { country: "United Arab Emirates", regions: ["Dubai", "Abu Dhabi", "Sharjah"] },
  { country: "Saudi Arabia", regions: ["Riyadh", "Jeddah", "Dammam"] },
  { country: "Qatar", regions: ["Doha"] },
  { country: "Oman", regions: ["Muscat"] },
  { country: "United Kingdom", regions: ["London", "Birmingham", "Manchester", "Leicester"] },
  { country: "United Kingdom", regions: ["London", "Luton", "Reading"] },
  { country: "United States", regions: ["Houston, Texas", "Atlanta, Georgia", "Washington, D.C.", "Dallas, Texas"] },
  { country: "United States", regions: ["Los Angeles, California", "San Diego, California", "Seattle, Washington"] },
  { country: "United States", regions: ["New York, New York", "Boston, Massachusetts", "Newark, New Jersey"] },
  { country: "Canada", regions: ["Toronto", "Calgary", "Ottawa"] },
  { country: "Australia", regions: ["Sydney", "Melbourne", "Perth"] },
  { country: "Germany", regions: ["Berlin", "Munich", "Hamburg"] },
  { country: "South Africa", regions: ["Johannesburg, Gauteng", "Cape Town", "Pretoria"] },
  { country: "Uganda", regions: ["Kampala", "Entebbe"] },
  { country: "Tanzania", regions: ["Dar es Salaam", "Zanzibar"] },
  { country: "Tanzania", regions: ["Arusha", "Moshi, Kilimanjaro"] },
  { country: "Rwanda", regions: ["Kigali"] },
  { country: "Ethiopia", regions: ["Addis Ababa"] },
  { country: "India", regions: ["New Delhi", "Mumbai", "Bengaluru"] },
  { country: "Nepal", regions: ["Kathmandu"] },
  { country: "China", regions: ["Guangzhou, Guangdong", "Beijing", "Shanghai"] },
  { country: "Japan", regions: ["Tokyo", "Osaka"] },
  { country: "South Korea", regions: ["Seoul"] },
  { country: "France", regions: ["Paris"] },
  { country: "Norway", regions: ["Oslo", "Bergen"] },
  { country: "Italy", regions: ["Rome", "Milan"] },
  { country: "Malta", regions: ["Valletta", "Sliema"] },
  { country: "Portugal", regions: ["Lisbon", "Porto"] }, // no Kenyan mission in this demo
];

const slugOf = (c: string) => c.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function seedAll(x: typeof db) {
  const now = new Date();
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600e3);
  const rand = mulberry32(20260101);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  // ---- Missions & jurisdictions ----
  const missionId: Record<string, string> = {};
  const missionName: Record<string, string> = {};
  const missionRows = MISSIONS.map((m, i) => {
    const id = randomUUID();
    missionId[m.key] = id;
    const name = m.kind === "embassy" ? `Embassy of Kenya in ${m.city}` : m.kind === "high_commission" ? `Kenya High Commission in ${m.city}` : `Consulate General of Kenya in ${m.city}`;
    missionName[m.key] = name;
    const slug = slugOf(m.city);
    const n = String(i + 1).padStart(2, "0");
    return {
      id,
      name,
      kind: m.kind,
      country: m.country,
      city: m.city,
      address: `Chancery address to be confirmed by the Ministry – ${m.city}, ${m.country} (placeholder)`,
      timezone: m.tz,
      phone: `+000 555 01${n}`,
      emergencyPhone: `+000 555 02${n}`,
      email: `consular.${slug}@embassy-connect.example`,
      website: `https://${slug}.embassy-connect.example`,
      openingHours: m.kind === "consulate" ? "Mon–Thu 09:30–15:00 by appointment only (placeholder – to be confirmed by the Ministry)." : "Mon–Fri 09:00–16:00 for appointments; phone line 08:30–17:00. Closed on local public holidays and Kenyan national holidays (placeholder – to be confirmed by the Ministry).",
      services: SERVICES.filter((sv) => m.services.includes(sv.id)),
      lastVerifiedAt: ago(m.v * 24),
    };
  });
  await x.insert(s.missions).values(missionRows);
  const jurisdictions = MISSIONS.flatMap((m) => m.serves.map(([country, region]) => ({ missionId: missionId[m.key], country, region })));
  await x.insert(s.missionJurisdictions).values(jurisdictions);
  const routing: RoutingEntry[] = jurisdictions.map((j) => {
    const m = MISSIONS.find((mm) => missionId[mm.key] === j.missionId)!;
    return { country: j.country, region: j.region, missionId: j.missionId, missionName: missionName[m.key], missionCity: m.city, missionCountry: m.country };
  });

  // ---- Staff (fictional) ----
  const mkStaff = (name: string, role: s.Role, mission: string | null) => ({
    id: randomUUID(),
    name,
    role,
    mission,
    email: `${name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/\s+/g, ".")}@staff.embassy-connect.example`,
  });
  const staff = {
    mercy: mkStaff("Mercy Atieno", "consular_officer", "dxb"),
    hassan: mkStaff("Hassan Abdi", "mission_admin", "dxb"),
    james: mkStaff("James Kiprono", "consular_officer", "lon"),
    esther: mkStaff("Esther Wambui", "mission_admin", "lon"),
    joseph: mkStaff("Joseph Mutua", "mission_admin", "nrt"),
    lucy: mkStaff("Lucy Njoroge", "mission_admin", "ruh"),
    sharon: mkStaff("Sharon Jepkemoi", "consular_officer", "lax"),
    moses: mkStaff("Moses Gitau", "mission_admin", "rom"),
    samuel: mkStaff("Samuel Otieno", "mission_admin", "pta"),
    david: mkStaff("David Kamau", "platform_admin", null),
  };
  await x.insert(s.users).values(Object.values(staff).map((u) => ({ id: u.id, email: u.email, displayName: u.name, role: u.role, missionId: u.mission ? missionId[u.mission] : null })));

  // ---- Named demo citizens (fictional) ----
  type Named = { key: string; name: string; email: string; dial: string; phone: string; lang: string; id: string };
  const named: Record<string, Named> = {};
  let phoneSeq = 0;
  const mkNamed = (key: string, name: string, lang = "English", dial = "+254"): Named => {
    const email = `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, ".")}@example.org`;
    phoneSeq++;
    return (named[key] = { key, name, email, dial, phone: `000 000 0${String(phoneSeq).padStart(2, "0")}`, lang, id: randomUUID() });
  };
  mkNamed("wanjiku", "Wanjiku Mwangi");
  mkNamed("brian", "Brian Otieno");
  mkNamed("fatuma", "Fatuma Hassan", "Kiswahili");
  mkNamed("kevin", "Kevin Kariuki");
  mkNamed("naomi", "Naomi Chebet", "English", "+971");
  mkNamed("daniel", "Daniel Kiprop");
  mkNamed("achieng", "Achieng Odhiambo", "English", "+27");
  mkNamed("kipchoge", "Kipchoge Rotich", "English", "+1");
  mkNamed("grace", "Grace Njeri");
  mkNamed("amani", "Amani Juma", "Kiswahili");
  mkNamed("mwende", "Mwende Kioko", "English", "+44");
  mkNamed("faith", "Faith Wambui", "Kiswahili", "+966");
  mkNamed("peter", "Peter Karanja", "English", "+974");

  type Bulk = { id: string; name: string; email: string };
  const bulk: Bulk[] = [];
  for (let i = 0; i < 60; i++) {
    const f = pick(FIRST);
    const l = pick(LAST);
    bulk.push({ id: randomUUID(), name: `${f} ${l}`, email: `${f}.${l}.${i + 1}@example.org`.toLowerCase().replace(/[^a-z0-9.@]/g, "") });
  }

  await x.insert(s.users).values([...Object.values(named).map((n) => ({ id: n.id, email: n.email, displayName: n.name })), ...bulk.map((b) => ({ id: b.id, email: b.email, displayName: b.name }))]);
  await x.insert(s.citizenProfiles).values([
    ...Object.values(named).map((n) => ({ userId: n.id, fullName: n.name, citizenship: "Kenya", phoneDial: n.dial, phoneNumber: n.phone, preferredLanguage: n.lang })),
    ...bulk.map((b, i) => ({ userId: b.id, fullName: b.name, citizenship: "Kenya", phoneDial: "+254", phoneNumber: `000 000 1${String(i).padStart(2, "0")}`, preferredLanguage: "English" })),
  ]);
  await x.insert(s.notificationPreferences).values([
    ...Object.values(named).map((n) => ({ userId: n.id, email: true, sms: n.key === "wanjiku" || n.key === "brian" || n.key === "faith", push: n.key === "wanjiku", reminders: true, reminderFrequency: n.key === "brian" ? "weekly" : "monthly" })),
    ...bulk.map((b) => ({ userId: b.id })),
  ]);
  await x.insert(s.emergencyContacts).values([
    { userId: named.wanjiku.id, name: "Daniel Mwangi", relationship: "Brother", phone: "+254 000 000 091", email: "daniel.mwangi@example.org" },
    { userId: named.brian.id, name: "Akinyi Otieno", relationship: "Mother", phone: "+254 000 000 092", email: null },
    { userId: named.achieng.id, name: "Otieno Odhiambo", relationship: "Spouse", phone: "+27 000 000 093", email: null },
    { userId: named.faith.id, name: "Mary Wambui", relationship: "Sister", phone: "+254 000 000 094", email: null },
  ]);

  // ---- Trips ----
  type TripSeed = {
    id: string;
    userId: string;
    ref: string;
    status: s.TripStatus;
    purpose: string;
    dests: { country: string; region: string; arr: string; dep: string | null }[];
    wellbeing?: s.WellbeingStatus;
    wellbeingAgoH?: number;
    createdAgoH: number;
    accommodation?: string;
    lodgingName?: string;
    arrivalConfirmed?: boolean;
  };
  const tripSeeds: TripSeed[] = [];
  const addTrip = (t: Omit<TripSeed, "id" | "ref">) => {
    const seed = { ...t, id: randomUUID(), ref: makeRef("TRV") };
    tripSeeds.push(seed);
    return seed;
  };

  const wanjikuTrip = addTrip({ userId: named.wanjiku.id, status: "active", purpose: "tourism", dests: [{ country: "United Arab Emirates", region: "Dubai, Al Barsha", arr: addDays(-4), dep: addDays(9) }], wellbeing: "safe", wellbeingAgoH: 46, createdAgoH: 24 * 12, lodgingName: "Sunrise Hotel Apartments", accommodation: "Al Barsha 1, near Mall of the Emirates, Dubai (sample address)", arrivalConfirmed: true });
  addTrip({ userId: named.wanjiku.id, status: "planned", purpose: "tourism", dests: [{ country: "Norway", region: "Oslo", arr: addDays(40), dep: addDays(47) }], createdAgoH: 24 * 3 });
  addTrip({ userId: named.wanjiku.id, status: "closed", purpose: "tourism", dests: [{ country: "Uganda", region: "Kampala", arr: addDays(-200), dep: addDays(-190) }], wellbeing: "left_country", wellbeingAgoH: 24 * 190, createdAgoH: 24 * 230, arrivalConfirmed: true });
  const brianTrip = addTrip({ userId: named.brian.id, status: "active", purpose: "tourism", dests: [{ country: "United Arab Emirates", region: "Dubai, Deira", arr: addDays(-6), dep: addDays(4) }], wellbeing: "need_assistance", wellbeingAgoH: 2, createdAgoH: 24 * 20, arrivalConfirmed: true });
  addTrip({ userId: named.fatuma.id, status: "active", purpose: "business", dests: [{ country: "United Arab Emirates", region: "Dubai, Marina", arr: addDays(-2), dep: addDays(5) }], wellbeing: "safe", wellbeingAgoH: 1.5, createdAgoH: 24 * 9, arrivalConfirmed: true });
  addTrip({ userId: named.kevin.id, status: "active", purpose: "business", dests: [{ country: "United Arab Emirates", region: "Abu Dhabi, Al Reem Island", arr: addDays(-1), dep: addDays(3) }], createdAgoH: 24 * 5, arrivalConfirmed: true });
  addTrip({ userId: named.naomi.id, status: "active", purpose: "work", dests: [{ country: "United Arab Emirates", region: "Dubai, Jumeirah", arr: addDays(-60), dep: addDays(100) }], wellbeing: "safe", wellbeingAgoH: 24 * 6, createdAgoH: 24 * 61, arrivalConfirmed: true });
  const danielTrip = addTrip({ userId: named.daniel.id, status: "active", purpose: "study", dests: [{ country: "Japan", region: "Tokyo", arr: addDays(-80), dep: addDays(280) }], wellbeing: "safe", wellbeingAgoH: 24 * 3, createdAgoH: 24 * 85, arrivalConfirmed: true });
  const achiengTrip = addTrip({ userId: named.achieng.id, status: "active", purpose: "work", dests: [{ country: "South Africa", region: "Johannesburg, Gauteng", arr: addDays(-30), dep: addDays(20) }, { country: "Lesotho", region: "Maseru", arr: addDays(20), dep: addDays(30) }], wellbeing: "safe", wellbeingAgoH: 24 * 5, createdAgoH: 24 * 35, arrivalConfirmed: true });
  const kipchogeTrip = addTrip({ userId: named.kipchoge.id, status: "active", purpose: "tourism", dests: [{ country: "United States", region: "Los Angeles, California", arr: addDays(-3), dep: addDays(6) }], wellbeing: "need_assistance", wellbeingAgoH: 20, createdAgoH: 24 * 8, arrivalConfirmed: true });
  const graceTrip = addTrip({ userId: named.grace.id, status: "active", purpose: "tourism", dests: [{ country: "Malta", region: "Valletta", arr: addDays(-2), dep: addDays(5) }], wellbeing: "safe", wellbeingAgoH: 30, createdAgoH: 24 * 15, arrivalConfirmed: true });
  addTrip({ userId: named.amani.id, status: "planned", purpose: "business", dests: [{ country: "China", region: "Guangzhou, Guangdong", arr: addDays(6), dep: addDays(13) }], createdAgoH: 24 * 4 });
  addTrip({ userId: named.mwende.id, status: "active", purpose: "residency", dests: [{ country: "United Kingdom", region: "London", arr: addDays(-400), dep: null }], wellbeing: "safe", wellbeingAgoH: 24 * 12, createdAgoH: 24 * 410, arrivalConfirmed: true });
  const faithTrip = addTrip({ userId: named.faith.id, status: "active", purpose: "work", dests: [{ country: "Saudi Arabia", region: "Riyadh", arr: addDays(-150), dep: addDays(580) }], wellbeing: "need_assistance", wellbeingAgoH: 24 * 5, createdAgoH: 24 * 151, arrivalConfirmed: true });
  addTrip({ userId: named.peter.id, status: "active", purpose: "work", dests: [{ country: "Qatar", region: "Doha", arr: addDays(-14), dep: addDays(300) }], wellbeing: "plans_changed", wellbeingAgoH: 24 * 2, createdAgoH: 24 * 20, arrivalConfirmed: true });

  for (const b of bulk) {
    const dest = pick(BULK_DESTS);
    const roll = rand();
    const gulfOrAsia = ["Saudi Arabia", "Qatar", "Oman"].includes(dest.country);
    const purpose = gulfOrAsia ? pick(["work", "work", "work", "pilgrimage", "other"]) : pick(["tourism", "tourism", "study", "study", "work", "business", "residency", "medical", "other"]);
    const region = pick(dest.regions);
    let status: s.TripStatus;
    let arr: string;
    let dep: string | null;
    if (roll < 0.6) {
      status = "active";
      arr = addDays(-ri(1, 40));
      dep = purpose === "residency" && rand() < 0.5 ? null : addDays(ri(1, 60));
    } else if (roll < 0.85) {
      status = "planned";
      arr = addDays(ri(1, 60));
      dep = addDays(ri(62, 90));
    } else {
      status = "closed";
      arr = addDays(-ri(40, 120));
      dep = addDays(-ri(1, 30));
    }
    const dests = [{ country: dest.country, region, arr, dep }];
    if (status !== "closed" && dep && rand() < 0.12) {
      const next = pick(BULK_DESTS.filter((d) => d.country !== dest.country && d.country !== "Portugal"));
      dests.push({ country: next.country, region: pick(next.regions), arr: dep, dep: addDays(ri(70, 100)) });
    }
    const w = rand();
    addTrip({
      userId: b.id,
      status,
      purpose,
      dests,
      wellbeing: status === "closed" ? "left_country" : status === "active" && rand() < 0.75 ? (w < 0.8 ? "safe" : w < 0.93 ? "plans_changed" : "need_assistance") : undefined,
      wellbeingAgoH: ri(2, 24 * 10),
      createdAgoH: ri(6, 24 * 56),
      arrivalConfirmed: status !== "planned",
    });
  }

  await x.insert(s.trips).values(
    tripSeeds.map((t) => {
      const geo = t.accommodation || t.lodgingName ? geocodePlace(`${t.lodgingName ?? ""} ${t.accommodation ?? ""} ${t.dests[0].region}`, t.dests[0].country) : null;
      return {
      id: t.id,
      reference: t.ref,
      userId: t.userId,
      status: t.status,
      purpose: t.purpose,
      startsOn: t.dests[0].arr,
      endsOn: t.dests[t.dests.length - 1].dep,
      accommodation: t.accommodation ?? null,
      lodgingName: t.lodgingName ?? null,
      lodgingPlace: geo?.place ?? null,
      lodgingLat: geo?.lat ?? null,
      lodgingLng: geo?.lng ?? null,
      contactEmail: null,
      contactPhone: null,
      arrivalConfirmedAt: t.arrivalConfirmed ? ago(Math.max(1, t.createdAgoH - 6)) : null,
      closedAt: t.status === "closed" ? new Date(`${t.dests[t.dests.length - 1].dep}T12:00:00Z`) : null,
      wellbeingStatus: t.wellbeing ?? null,
      wellbeingUpdatedAt: t.wellbeing ? ago(t.wellbeingAgoH ?? 24) : null,
      createdAt: ago(t.createdAgoH),
    };
    }),
  );
  await x.insert(s.tripDestinations).values(
    tripSeeds.flatMap((t) =>
      t.dests.map((d, i) => ({
        tripId: t.id,
        position: i,
        country: d.country,
        region: d.region,
        missionId: resolveRouting(routing, d.country, d.region)?.missionId ?? null,
        arrivalDate: d.arr,
        departureDate: d.dep,
      })),
    ),
  );
  await x.insert(s.tripEvents).values(
    tripSeeds.flatMap((t) => {
      const ev = [{ tripId: t.id, userId: t.userId, type: "registered", summary: `Trip ${t.ref} registered`, createdAt: ago(t.createdAgoH) }];
      if (t.arrivalConfirmed) ev.push({ tripId: t.id, userId: t.userId, type: "arrival_confirmed", summary: "Arrival confirmed", createdAt: ago(Math.max(1, t.createdAgoH - 6)) });
      if (t.status === "closed") ev.push({ tripId: t.id, userId: t.userId, type: "closed", summary: "Trip closed after departure", createdAt: new Date(`${t.dests[t.dests.length - 1].dep}T12:00:00Z`) });
      return ev;
    }),
  );
  const wellbeingRows: (typeof s.wellbeingUpdates.$inferInsert)[] = tripSeeds
    .filter((t) => t.wellbeing)
    .map((t) => ({ userId: t.userId, tripId: t.id, status: t.wellbeing!, source: "citizen" as const, createdAt: ago(t.wellbeingAgoH ?? 24), note: null }));
  wellbeingRows.push(
    { userId: named.wanjiku.id, tripId: wanjikuTrip.id, status: "safe", note: "Arrived in Dubai, all good.", source: "citizen", createdAt: ago(24 * 4) },
    { userId: named.brian.id, tripId: brianTrip.id, status: "safe", note: "Exploring the old town.", source: "citizen", createdAt: ago(24 * 3) },
  );
  await x.insert(s.wellbeingUpdates).values(wellbeingRows);
  await x.insert(s.dependants).values([
    { userId: named.achieng.id, tripId: achiengTrip.id, fullName: "Otieno Odhiambo", relationship: "Spouse or partner", birthYear: 1986, consentConfirmedAt: ago(24 * 34) },
    { userId: named.achieng.id, tripId: achiengTrip.id, fullName: "Zawadi Odhiambo", relationship: "Child", birthYear: 2016, consentConfirmedAt: ago(24 * 34) },
  ]);

  // ---- Assistance cases ----
  const mkCase = async (o: {
    user: string; trip: string; mission: string; category: s.CaseCategory; description: string; location: string;
    urgency: "urgent" | "soon" | "routine"; priority: s.Priority; status: s.CaseStatus; assignee?: string; createdAgoH: number;
    resolution?: string; messages?: { by: "citizen" | "staff"; author: string; kind?: "message" | "info_request"; body: string; agoH: number }[];
    notes?: { author: string; body: string; agoH: number }[]; events: { actor: "citizen" | "staff" | "system"; actorId?: string; type: string; summary: string; visible?: boolean; agoH: number }[];
    email: string;
  }) => {
    const [c] = await x.insert(s.assistanceCases).values({
      reference: makeRef("CASE"), userId: o.user, tripId: o.trip, missionId: missionId[o.mission], category: o.category, description: o.description,
      location: o.location, contactMethod: "email", contactDetail: o.email, citizenUrgency: o.urgency, priority: o.priority, status: o.status,
      assignedToId: o.assignee ?? null, resolutionNote: o.resolution ?? null, resolvedAt: o.status === "resolved" ? ago(o.createdAgoH - 20) : null, createdAt: ago(o.createdAgoH),
    }).returning();
    if (o.messages?.length) await x.insert(s.caseMessages).values(o.messages.map((m) => ({ caseId: c.id, authorId: m.author, authorKind: m.by, kind: m.kind ?? ("message" as const), body: m.body, createdAt: ago(m.agoH) })));
    if (o.notes?.length) await x.insert(s.caseNotes).values(o.notes.map((n) => ({ caseId: c.id, authorId: n.author, body: n.body, createdAt: ago(n.agoH) })));
    await x.insert(s.caseEvents).values(o.events.map((e) => ({ caseId: c.id, actorId: e.actorId ?? null, actorKind: e.actor, type: e.type, summary: e.summary, citizenVisible: e.visible ?? true, createdAt: ago(e.agoH) })));
    return c;
  };

  const wanjikuCase = await mkCase({
    user: named.wanjiku.id, trip: wanjikuTrip.id, mission: "dxb", category: "lost_passport", email: named.wanjiku.email,
    description: "My handbag with my passport was stolen from a taxi in Dubai. I have reported it to the police. My flight home to Nairobi is in 9 days and I need to know my options.",
    location: "Al Barsha, Dubai", urgency: "soon", priority: "high", status: "awaiting_citizen", assignee: staff.mercy.id, createdAgoH: 30,
    messages: [{ by: "staff", author: staff.mercy.id, kind: "info_request", body: "Thank you for contacting us, and we're sorry this happened. Please reply with the police report number (if you have one) and the date you reported the theft. A photo or copy of your old passport or your national ID is helpful but not essential.", agoH: 22 }],
    notes: [{ author: staff.mercy.id, body: "Flight home in 9 days. Offer an emergency travel document slot if no police report is available by Friday.", agoH: 21 }],
    events: [
      { actor: "citizen", actorId: named.wanjiku.id, type: "submitted", summary: "Request submitted by citizen", agoH: 30 },
      { actor: "staff", actorId: staff.mercy.id, type: "assigned", summary: "Assigned to the consular assistance team", agoH: 24 },
      { actor: "staff", actorId: staff.mercy.id, type: "priority", summary: "Priority set to High", visible: false, agoH: 24 },
      { actor: "staff", actorId: staff.mercy.id, type: "info_requested", summary: "Embassy requested more information", agoH: 22 },
    ],
  });
  await mkCase({
    user: named.brian.id, trip: brianTrip.id, mission: "dxb", category: "crisis_info", email: named.brian.email,
    description: "Roads near Deira are flooded and water is entering the hotel lobby. I'd like official information on what to do and whether it is safe to travel to the airport.",
    location: "Deira, Dubai", urgency: "urgent", priority: "urgent", status: "submitted", createdAgoH: 2,
    events: [{ actor: "citizen", actorId: named.brian.id, type: "submitted", summary: "Request submitted by citizen", agoH: 2 }],
  });
  await mkCase({
    user: named.kipchoge.id, trip: kipchogeTrip.id, mission: "lax", category: "medical", email: named.kipchoge.email,
    description: "I fractured my wrist in a fall and I'm in hospital in Los Angeles. I'd like help contacting my family in Kenya and understanding my insurance paperwork.",
    location: "Hospital in Los Angeles, California", urgency: "soon", priority: "high", status: "in_progress", assignee: staff.sharon.id, createdAgoH: 20,
    messages: [{ by: "staff", author: staff.sharon.id, body: "We're sorry to hear that. We have noted your request. With your permission we can contact your family. Reply 'yes' and tell us who to contact.", agoH: 18 }],
    events: [
      { actor: "citizen", actorId: named.kipchoge.id, type: "submitted", summary: "Request submitted by citizen", agoH: 20 },
      { actor: "staff", actorId: staff.sharon.id, type: "status", summary: "Status changed to In progress", agoH: 18 },
    ],
  });
  await mkCase({
    user: named.grace.id, trip: graceTrip.id, mission: "rom", category: "crime", email: named.grace.email,
    description: "My phone and wallet were stolen in Valletta. I've filed a police report. I need advice on replacing my cards and documents. (Malta is served by the Embassy in Rome.)",
    location: "Valletta, Malta", urgency: "routine", priority: "normal", status: "submitted", createdAgoH: 9,
    events: [{ actor: "citizen", actorId: named.grace.id, type: "submitted", summary: "Request submitted by citizen", agoH: 9 }],
  });
  await mkCase({
    user: named.daniel.id, trip: danielTrip.id, mission: "nrt", category: "lost_passport", email: named.daniel.email,
    description: "I lost my passport on a train in Tokyo. I've reported it to the local police.",
    location: "Tokyo, Japan", urgency: "soon", priority: "normal", status: "resolved", assignee: staff.joseph.id, createdAgoH: 24 * 10,
    resolution: "Replacement passport issued and collected in person. No further action required.",
    messages: [{ by: "staff", author: staff.joseph.id, body: "Your replacement passport is ready for collection by appointment.", agoH: 24 * 6 }],
    events: [
      { actor: "citizen", actorId: named.daniel.id, type: "submitted", summary: "Request submitted by citizen", agoH: 24 * 10 },
      { actor: "staff", actorId: staff.joseph.id, type: "resolved", summary: "Request resolved", agoH: 24 * 5 },
    ],
  });
  await mkCase({
    user: named.achieng.id, trip: achiengTrip.id, mission: "pta", category: "other", email: named.achieng.email,
    description: "Which documents does my daughter need to travel with me from South Africa to Lesotho by road? (Lesotho is served by the High Commission in Pretoria.)",
    location: "Johannesburg, South Africa", urgency: "routine", priority: "low", status: "under_review", createdAgoH: 24 * 2,
    events: [{ actor: "citizen", actorId: named.achieng.id, type: "submitted", summary: "Request submitted by citizen", agoH: 24 * 2 }],
  });
  await mkCase({
    user: named.faith.id, trip: faithTrip.id, mission: "ruh", category: "labour", email: named.faith.email,
    description: "I have not been paid for three months and my employer is keeping my passport. I am not allowed to leave the house alone. Please call me when I can speak safely, usually after 10pm.",
    location: "Riyadh, Saudi Arabia", urgency: "urgent", priority: "high", status: "in_progress", assignee: staff.lucy.id, createdAgoH: 24 * 5,
    messages: [
      { by: "staff", author: staff.lucy.id, body: "Thank you for contacting us. Your safety comes first. We will only call after 10pm as you asked, and we will not contact your employer without discussing it with you. If you are ever in immediate danger, call local emergency services.", agoH: 24 * 5 - 3 },
      { by: "citizen", author: named.faith.id, body: "Thank you. Please do not message my employer's number. I can speak tomorrow night.", agoH: 24 * 4 },
    ],
    notes: [{ author: staff.lucy.id, body: "Welfare referral under consideration. Check recruitment agency details with the relevant Kenyan authority. Do not contact employer before the citizen agrees.", agoH: 24 * 4 - 2 }],
    events: [
      { actor: "citizen", actorId: named.faith.id, type: "submitted", summary: "Request submitted by citizen", agoH: 24 * 5 },
      { actor: "staff", actorId: staff.lucy.id, type: "assigned", summary: "Assigned to the consular assistance team", agoH: 24 * 5 - 2 },
      { actor: "staff", actorId: staff.lucy.id, type: "priority", summary: "Priority set to High", visible: false, agoH: 24 * 5 - 2 },
      { actor: "staff", actorId: staff.lucy.id, type: "status", summary: "Status changed to In progress", agoH: 24 * 4 - 1 },
    ],
  });

  await x.insert(s.notifications).values([
    { userId: named.wanjiku.id, kind: "case", title: "The embassy needs more information", body: `Your request ${wanjikuCase.reference} is waiting for your reply.`, href: `/app/cases/${wanjikuCase.id}`, severity: "advisory", createdAt: ago(22) },
    { userId: named.wanjiku.id, kind: "trip", title: "Trip registration confirmed", body: `Your trip ${wanjikuTrip.ref} to the United Arab Emirates is registered.`, href: `/app/trips/${wanjikuTrip.id}`, readAt: ago(100), createdAt: ago(24 * 12) },
  ]);

  // ---- Appointments ----
  const apptRows: (typeof s.appointments.$inferInsert)[] = [];
  const slotTimes = ["09:30", "11:00", "14:00"];
  for (const m of MISSIONS) {
    const svc = SERVICES.filter((sv) => m.services.includes(sv.id)).slice(0, 2);
    for (let d = 1, made = 0; d <= 12 && made < 5; d++) {
      const date = addDays(d);
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      made++;
      for (const sv of svc) for (const t of slotTimes) {
        apptRows.push({ missionId: missionId[m.key], serviceId: sv.id, serviceName: sv.name, startsAt: zonedToUtc(date, t, m.tz), durationMin: sv.durationMin, status: "available" });
      }
    }
  }
  let booked = 0;
  for (const row of apptRows) {
    if (row.missionId === missionId.dxb && booked < 6 && rand() < 0.2) {
      row.status = "booked";
      row.userId = pick(bulk).id;
      row.reference = makeRef("APT");
      row.bookedAt = ago(ri(5, 100));
      booked++;
    }
  }
  const etd = SERVICES.find((sv) => sv.id === "etd")!;
  const adv = SERVICES.find((sv) => sv.id === "advice")!;
  const pass = SERVICES.find((sv) => sv.id === "passport")!;
  apptRows.push(
    { missionId: missionId.dxb, userId: named.wanjiku.id, reference: makeRef("APT"), serviceId: etd.id, serviceName: etd.name, startsAt: zonedToUtc(addDays(3), "10:00", "Asia/Dubai"), durationMin: 30, status: "booked", bookedAt: ago(20) },
    { missionId: missionId.dxb, userId: named.wanjiku.id, reference: makeRef("APT"), serviceId: adv.id, serviceName: adv.name, startsAt: zonedToUtc(addDays(-5), "11:00", "Asia/Dubai"), durationMin: 20, status: "cancelled", bookedAt: ago(24 * 9), cancelledAt: ago(24 * 7), cancelledBy: "citizen" },
    { missionId: missionId.nrt, userId: named.daniel.id, reference: makeRef("APT"), serviceId: pass.id, serviceName: pass.name, startsAt: zonedToUtc(addDays(-5), "10:30", "Asia/Tokyo"), durationMin: 30, status: "attended", bookedAt: ago(24 * 9) },
  );
  await x.insert(s.appointments).values(apptRows);

  // ---- Crisis event (sample scenario) and alerts ----
  const crisisId = randomUUID();
  await x.insert(s.crisisEvents).values({
    id: crisisId, missionId: missionId.dxb, createdById: staff.hassan.id, title: "Flooding in parts of Dubai (sample scenario)",
    description: "Sample scenario for demonstration: heavy rain and flooding reported in several Dubai neighbourhoods. Some roads are closed.",
    message: "Heavy rain and flooding are reported in parts of Dubai. If you are in the area, please tell us whether you're safe. Replying is voluntary. Sharing your location is optional and will only be used for this request. If you are in immediate danger, call local emergency services (999 in the UAE). (Sample scenario for demonstration.)",
    country: "United Arab Emirates", region: "Dubai", requestLocation: true, status: "active", sentAt: ago(3),
  });
  const targets = await findRecipients({ missionId: missionId.dxb, country: "United Arab Emirates", region: "Dubai", audience: "active" }, x);
  const crisisAnswers: Record<string, { response: s.CrisisAnswer | null; note?: string; loc?: string }> = {
    [named.brian.id]: { response: "need_help", note: "Water is in the hotel lobby and the road out is flooded.", loc: "Hotel in Deira, near the creek" },
    [named.fatuma.id]: { response: "safe" },
    [named.naomi.id]: { response: "not_affected", note: "I'm in Mombasa this week." },
  };
  await x.insert(s.crisisResponses).values(
    targets.map((t) => {
      const a = crisisAnswers[t.userId];
      return {
        crisisEventId: crisisId, userId: t.userId, tripId: t.tripId, response: a?.response ?? null, note: a?.note ?? null,
        locationText: a?.loc ?? null, locationConsentAt: a?.loc ? ago(1) : null, respondedAt: a?.response ? ago(a.response === "need_help" ? 1 : 2) : null,
      };
    }),
  );
  await x.update(s.crisisEvents).set({ targetedCount: targets.length }).where(sql`id = ${crisisId}`);
  await x.insert(s.notifications).values(
    targets.map((t) => ({ userId: t.userId, kind: "crisis" as const, title: "Wellbeing check: flooding in parts of Dubai", body: "Please tell the embassy whether you are safe. Replying is voluntary.", href: `/app/crisis/${crisisId}`, severity: "critical" as const, createdAt: ago(3), readAt: crisisAnswers[t.userId]?.response ? ago(1) : null })),
  );

  const alertDefs: { m: string; author: string; title: string; body: string; category: s.AlertCategory; severity: s.Severity; country: string; region?: string; audience?: "all" | "active" | "planned"; status: "draft" | "published" | "expired"; pubH?: number; expDays?: number; crisis?: boolean }[] = [
    { m: "dxb", author: staff.hassan.id, title: "Flooding in parts of Dubai: wellbeing check (sample scenario)", body: "Heavy rain and flooding are affecting parts of Dubai. Follow instructions from local authorities. Please respond to the wellbeing check we sent you. Replying is voluntary and sharing your location is optional.", category: "crisis", severity: "critical", country: "United Arab Emirates", region: "Dubai", audience: "active", status: "published", pubH: 3, expDays: 2, crisis: true },
    { m: "dxb", author: staff.hassan.id, title: "Extreme heat: advice for people who work outdoors", body: "Very high temperatures are expected this week. If you work outdoors, ask for rest, shade and water breaks during the hottest hours. Keep your employer's details and our contact details with you. If you are being made to work in unsafe heat, tell us.", category: "safety", severity: "advisory", country: "United Arab Emirates", status: "published", pubH: 30, expDays: 5 },
    { m: "lon", author: staff.esther.id, title: "Rail strike on Thursday", body: "A 24-hour rail strike is announced. Expect delays to and from the airports. Allow extra time and consider coaches or ride-hailing.", category: "safety", severity: "advisory", country: "United Kingdom", region: "London", status: "published", pubH: 26, expDays: 3 },
    { m: "lon", author: staff.esther.id, title: "Consular section closed for a UK bank holiday", body: "The consular section is closed on the bank holiday. Online requests are still accepted but will not be reviewed until the next working day.", category: "service_update", severity: "info", country: "United Kingdom", status: "published", pubH: 50, expDays: 10 },
    { m: "lon", author: staff.james.id, title: "Updated appointment hours (draft)", body: "From next month, phone support will be available 09:00–15:00.", category: "service_update", severity: "info", country: "United Kingdom", status: "draft" },
    { m: "lon", author: staff.esther.id, title: "Road closures for a city marathon", body: "Central roads were closed on Sunday morning. This notice has expired.", category: "travel_guidance", severity: "info", country: "United Kingdom", region: "London", status: "expired", pubH: 24 * 20, expDays: -10 },
    { m: "ruh", author: staff.lucy.id, title: "Hajj and Umrah: keep your documents and our contact details with you", body: "If you are travelling for Hajj or Umrah, keep your passport, permit and our contact details with you. Follow the instructions of the Saudi authorities and your group leader. Register your trip so we can reach you if needed.", category: "travel_guidance", severity: "info", country: "Saudi Arabia", status: "published", pubH: 60, expDays: 20 },
    { m: "pta", author: staff.samuel.id, title: "Planned demonstrations in Pretoria", body: "Demonstrations are planned in central Pretoria on Friday. Avoid large gatherings, follow local news and allow extra travel time.", category: "safety", severity: "warning", country: "South Africa", region: "Pretoria", status: "published", pubH: 10, expDays: 2 },
    { m: "rom", author: staff.moses.id, title: "Heatwave advisory for Malta", body: "Temperatures are expected to exceed 38°C this week. Stay hydrated, avoid the midday sun and check on older relatives travelling with you. (Malta is served by the Embassy in Rome.)", category: "travel_guidance", severity: "advisory", country: "Malta", status: "published", pubH: 20, expDays: 4 },
    { m: "nrt", author: staff.joseph.id, title: "Typhoon season: how to prepare", body: "Typhoon season is underway. Check local weather warnings, keep your phone charged and note your nearest shelter.", category: "travel_guidance", severity: "info", country: "Japan", status: "published", pubH: 72, expDays: 30 },
  ];
  for (const a of alertDefs) {
    const recipients = a.status === "draft" ? 0 : (await findRecipients({ missionId: missionId[a.m], country: a.country, region: a.region, audience: a.audience ?? "all" }, x)).length;
    await x.insert(s.alerts).values({
      missionId: missionId[a.m], authorId: a.author, title: a.title, body: a.body, category: a.category, severity: a.severity, country: a.country,
      region: a.region ?? null, audience: a.audience ?? "all", status: a.status, recipientCount: recipients, crisisEventId: a.crisis ? crisisId : null,
      publishedAt: a.pubH ? ago(a.pubH) : null, expiresAt: a.expDays !== undefined ? new Date(now.getTime() + a.expDays * 86400e3) : null,
    });
  }

  await x.insert(s.feedback).values([
    { userId: named.daniel.id, missionId: missionId.nrt, rating: 5, topic: "Case handling", message: "Quick and kind response when I lost my passport." },
    { userId: named.grace.id, missionId: missionId.rom, rating: 4, topic: "Website", message: "Easy to find the right embassy for Malta. I didn't realise Rome covers it." },
    { userId: named.mwende.id, missionId: missionId.lon, rating: 3, topic: "Appointments", message: "More evening or Saturday slots would help people who work shifts." },
    { userId: bulk[3].id, missionId: missionId.dxb, rating: 5, topic: "Alerts", message: "Alerts were clear and told me what to do." },
    { userId: bulk[7].id, missionId: missionId.dxb, rating: 4, topic: "Other", message: "Check-in took two minutes." },
    { userId: named.faith.id, missionId: missionId.ruh, rating: 5, topic: "Case handling", message: "Thank you for asking how to contact me safely." },
  ]);

  // ---- Audit history (summaries never contain sensitive content) ----
  type Actor = { id: string; name: string; role: string; mission: string | null };
  const A = (actor: Actor, hours: number, action: string, entityType: string, summary: string) => ({
    actorId: actor.id, actorName: actor.name, actorRole: actor.role, missionId: actor.mission ? missionId[actor.mission] : null, action, entityType, entityId: null, summary, createdAt: ago(hours),
  });
  await x.insert(s.auditEvents).values([
    A(staff.hassan, 3, "crisis.send", "crisis_event", `Wellbeing check sent to ${targets.length} citizens (simulated delivery)`),
    A(staff.hassan, 3, "alert.publish", "alert", "Alert published: flooding in parts of Dubai (simulated delivery)"),
    A(staff.mercy, 24, "case.assign", "case", "Case assigned to Mercy Atieno"),
    A(staff.mercy, 22, "case.message", "case", "Staff message sent to citizen (information request)"),
    A(staff.mercy, 21, "case.view", "case", "Case record opened"),
    A(staff.mercy, 25, "registration.view", "trip", "Registration record opened"),
    A(staff.esther, 50, "alert.publish", "alert", "Alert published: consular section closed for a bank holiday (simulated delivery)"),
    A(staff.esther, 72, "mission.update", "mission", "Mission opening hours updated"),
    A(staff.sharon, 18, "case.status", "case", "Case status changed to In progress"),
    A(staff.lucy, 24 * 5 - 2, "case.assign", "case", "Case assigned to Lucy Njoroge"),
    A(staff.lucy, 24 * 4 - 1, "case.status", "case", "Case status changed to In progress"),
    A(staff.david, 24 * 5, "mission.verify", "mission", "Contact details marked as verified"),
    A(staff.moses, 20, "alert.publish", "alert", "Alert published: heatwave advisory for Malta (simulated delivery)"),
    A(staff.joseph, 24 * 5, "case.resolve", "case", "Case resolved with resolution note"),
  ]);
}
