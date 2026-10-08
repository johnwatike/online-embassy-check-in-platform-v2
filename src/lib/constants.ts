import type {
  AlertCategory,
  AppointmentStatus,
  CaseCategory,
  CaseStatus,
  CrisisAnswer,
  Priority,
  Role,
  Severity,
  TripStatus,
  WellbeingStatus,
} from "@/db/schema";

export const HOME_COUNTRY = "Kenya";
/** Change here if the Ministry prefers its full official title (e.g. "Ministry of Foreign and Diaspora Affairs"). */
export const MINISTRY = "Ministry of Foreign Affairs";
export const BRAND = "Embassy Connect";

export type Tone = "neutral" | "teal" | "gold" | "red" | "amber" | "green" | "navy";

export const MISSION_KIND: Record<"embassy" | "high_commission" | "consulate", string> = {
  embassy: "Embassy",
  high_commission: "High Commission",
  consulate: "Consulate General",
};

/** Destination countries a Kenyan can register. Some (Portugal, Greece, Poland, Czechia, Philippines, Mauritius, Namibia) have no mission in this demo on purpose. */
export const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Bangladesh", "Belgium", "Benin", "Bhutan", "Bolivia", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Cambodia", "Cameroon", "Canada", "Chile", "China", "Costa Rica", "Czechia", "Denmark", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Georgia", "Germany", "Ghana",
  "Greece", "Guinea", "Honduras", "Iceland", "India", "Indonesia", "Ireland", "Italy", "Japan", "Jordan", "Kiribati", "Kuwait",
  "Laos", "Latvia", "Lesotho", "Liberia", "Lithuania", "Malawi", "Malaysia", "Maldives", "Malta", "Mauritius", "Mexico",
  "Mongolia", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Nigeria", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palestine", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Rwanda", "Samoa", "Saudi Arabia", "Seychelles", "Sierra Leone", "Singapore", "Somalia",
  "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Turkey", "Uganda", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Vanuatu",
  "Vietnam", "Zambia", "Zimbabwe",
];

/** Publicly documented local emergency numbers. The demo does NOT verify these — always confirm locally. */
export const LOCAL_EMERGENCY: Record<string, string> = {
  "United Kingdom": "999 or 112 (all emergencies)",
  Ireland: "112 or 999 (all emergencies)",
  "United States": "911 (all emergencies)",
  Canada: "911 (all emergencies)",
  Mexico: "911 (all emergencies)",
  Brazil: "190 police · 192 ambulance · 193 fire",
  Germany: "112 fire and ambulance · 110 police",
  France: "112 (all emergencies) · 15 medical · 17 police",
  Belgium: "112 (all emergencies)",
  Italy: "112 (all emergencies)",
  Malta: "112 (all emergencies)",
  Spain: "112 (all emergencies)",
  Netherlands: "112 (all emergencies)",
  Austria: "112 (all emergencies) · 133 police",
  Switzerland: "112 · 117 police · 144 ambulance",
  Sweden: "112 (all emergencies)",
  Norway: "112 police · 113 ambulance · 110 fire",
  Russia: "112 (all emergencies)",
  Turkey: "112 (all emergencies)",
  "United Arab Emirates": "999 police · 998 ambulance · 997 fire",
  "Saudi Arabia": "911 (all emergencies) · 997 ambulance",
  Qatar: "999 (all emergencies)",
  Kuwait: "112 (all emergencies)",
  Oman: "9999 (all emergencies)",
  Egypt: "122 police · 123 ambulance · 180 fire",
  China: "110 police · 120 ambulance · 119 fire",
  India: "112 (all emergencies)",
  Nepal: "100 police · 102 ambulance",
  Japan: "110 police · 119 fire and ambulance",
  "South Korea": "112 police · 119 fire and ambulance",
  Thailand: "191 police · 1669 medical emergencies",
  Malaysia: "999 (all emergencies)",
  Indonesia: "112 general · 110 police · 118 ambulance",
  Pakistan: "15 police · 1122 rescue",
  Australia: "000 (all emergencies)",
  "New Zealand": "111 (all emergencies)",
  "South Africa": "112 (mobile) · 10111 police · 10177 ambulance",
  Lesotho: "112 or 123 police",
  Uganda: "999 or 112 (all emergencies)",
  Tanzania: "112 or 999 (all emergencies)",
  Rwanda: "112 (all emergencies)",
  Ethiopia: "991 police · 907 ambulance",
  Nigeria: "112 or 199",
  Ghana: "112 or 191 police",
  Zambia: "999 police · 991 ambulance",
  Zimbabwe: "995 police · 994 ambulance",
  Portugal: "112 (all emergencies)",
};

export const FALLBACK_CONTACT = {
  name: "Ministry of Foreign Affairs – Consular and Diaspora desk, Nairobi (placeholder)",
  phone: "+000 555 0100",
  email: "consular@embassy-connect.example",
};

export const DIAL_CODES = [
  "+254", "+255", "+256", "+250", "+251", "+27", "+233", "+234", "+20", "+971", "+966", "+974", "+968", "+965", "+90",
  "+44", "+353", "+1", "+52", "+55", "+49", "+33", "+39", "+34", "+31", "+32", "+41", "+43", "+46", "+7", "+81", "+82",
  "+86", "+91", "+92", "+60", "+62", "+66", "+61", "+64",
];

export const LANGUAGES = ["English", "Kiswahili", "Français", "العربية", "Deutsch", "中文", "日本語", "Español"];

export const PURPOSES: Record<string, string> = {
  tourism: "Tourism or holiday",
  study: "Study",
  work: "Work (including contract employment abroad)",
  business: "Business trip",
  residency: "Residency / living abroad",
  medical: "Medical treatment",
  pilgrimage: "Pilgrimage (Hajj, Umrah or other)",
  other: "Other",
};

export const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone; help: string }> = {
  planned: { label: "Registered – upcoming", tone: "navy", help: "You registered before travelling. Confirm your arrival once you get there." },
  active: { label: "Active – arrival confirmed", tone: "teal", help: "You are registered as currently in this destination." },
  closed: { label: "Closed", tone: "neutral", help: "This trip has ended. Its history is kept for your records." },
  cancelled: { label: "Cancelled", tone: "neutral", help: "You cancelled this registration before travelling." },
};

export const WELLBEING: Record<WellbeingStatus, { label: string; short: string; tone: Tone; description: string; icon: string }> = {
  safe: { label: "I'm safe", short: "Safe", tone: "green", description: "Let the embassy know you're well.", icon: "✓" },
  plans_changed: { label: "My travel plans changed", short: "Plans changed", tone: "amber", description: "You're safe, but dates or destination have changed.", icon: "↻" },
  need_assistance: { label: "I need assistance", short: "Needs assistance", tone: "red", description: "Ask the embassy for help. This opens an urgent assistance request.", icon: "!" },
  left_country: { label: "I have left the country", short: "Left the country", tone: "neutral", description: "Close this trip. Your history is kept.", icon: "→" },
};

export const CASE_CATEGORIES: Record<CaseCategory, { label: string; description: string; icon: string }> = {
  lost_passport: { label: "Lost or stolen passport", description: "Replace a lost, stolen or damaged Kenyan passport or travel document.", icon: "🛂" },
  medical: { label: "Medical emergency", description: "A serious illness or injury abroad and you need consular support.", icon: "✚" },
  detention: { label: "Arrest or detention", description: "You, or someone you know, has been arrested or detained.", icon: "⚖" },
  crime: { label: "Crime or personal safety", description: "You are a victim of crime or feel unsafe.", icon: "🛡" },
  labour: { label: "Employment or labour problem", description: "Unpaid wages, abuse, a held passport, contract disputes or unsafe working or living conditions.", icon: "💼" },
  death: { label: "Death of a Kenyan abroad", description: "Report a death, or ask about registration and repatriation of remains. Family members can use this.", icon: "🕯" },
  crisis_info: { label: "Crisis or evacuation information", description: "Ask about official information during a crisis. Evacuation is never guaranteed.", icon: "⚠" },
  other: { label: "Other consular assistance", description: "Anything else you need the embassy's help with.", icon: "✉" },
};

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone; help: string }> = {
  submitted: { label: "Submitted", tone: "navy", help: "We've received your request. It has not been reviewed yet." },
  under_review: { label: "Under review", tone: "amber", help: "A consular officer is reviewing your request." },
  awaiting_citizen: { label: "Awaiting your response", tone: "gold", help: "The embassy needs more information from you." },
  in_progress: { label: "In progress", tone: "teal", help: "The embassy is working on your request." },
  resolved: { label: "Resolved", tone: "green", help: "This request has been closed with a resolution note." },
};

export const PRIORITY: Record<Priority, { label: string; tone: Tone; rank: number }> = {
  urgent: { label: "Urgent", tone: "red", rank: 0 },
  high: { label: "High", tone: "amber", rank: 1 },
  normal: { label: "Normal", tone: "navy", rank: 2 },
  low: { label: "Low", tone: "neutral", rank: 3 },
};

export const URGENCY = {
  urgent: "Urgent – someone's safety or health is at risk now",
  soon: "Soon – I need help within a few days",
  routine: "Routine – no immediate time pressure",
} as const;

export const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  info: { label: "Information", tone: "navy" },
  advisory: { label: "Advisory", tone: "gold" },
  warning: { label: "Warning", tone: "amber" },
  critical: { label: "Critical", tone: "red" },
};

export const ALERT_CATEGORY: Record<AlertCategory, string> = {
  safety: "Safety notice",
  travel_guidance: "Travel guidance",
  service_update: "Embassy service update",
  crisis: "Crisis wellbeing request",
};

export const CRISIS_ANSWER: Record<CrisisAnswer, { label: string; tone: Tone; description: string }> = {
  safe: { label: "I'm safe", tone: "green", description: "I'm in the affected area and I'm safe." },
  need_help: { label: "I need help", tone: "red", description: "I'm in the affected area and need help from the embassy." },
  not_affected: { label: "I'm not in the affected area", tone: "neutral", description: "I'm somewhere else, so this doesn't apply to me." },
};

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "teal" },
  booked: { label: "Booked", tone: "navy" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  attended: { label: "Attended", tone: "green" },
  no_show: { label: "Did not attend", tone: "amber" },
  rescheduled: { label: "Rescheduled", tone: "neutral" },
};

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Citizen",
  consular_officer: "Consular officer",
  mission_admin: "Mission administrator",
  platform_admin: "Platform administrator (Ministry HQ)",
};

// ----- Permissions (least privilege). Enforced on the server in every action and page. -----
export type Permission =
  | "records.view"
  | "cases.manage"
  | "appointments.manage"
  | "alerts.draft"
  | "alerts.publish"
  | "crisis.view"
  | "crisis.manage"
  | "mission.view"
  | "mission.edit"
  | "audit.view"
  | "reports.view";

export const PERMISSIONS: Record<Permission, { label: string; roles: Role[] }> = {
  "records.view": { label: "View citizen registrations in own jurisdiction", roles: ["consular_officer", "mission_admin"] },
  "cases.manage": { label: "Review, assign and update assistance cases", roles: ["consular_officer", "mission_admin"] },
  "appointments.manage": { label: "Manage appointment slots and bookings", roles: ["consular_officer", "mission_admin"] },
  "alerts.draft": { label: "Draft and preview alerts", roles: ["consular_officer", "mission_admin"] },
  "alerts.publish": { label: "Publish and expire alerts", roles: ["mission_admin"] },
  "crisis.view": { label: "View crisis wellbeing responses", roles: ["consular_officer", "mission_admin"] },
  "crisis.manage": { label: "Create crisis events and send wellbeing checks", roles: ["mission_admin"] },
  "mission.view": { label: "View mission settings", roles: ["consular_officer", "mission_admin", "platform_admin"] },
  "mission.edit": { label: "Edit mission details, jurisdiction and services", roles: ["mission_admin", "platform_admin"] },
  "audit.view": { label: "View audit history and staff roles", roles: ["mission_admin", "platform_admin"] },
  "reports.view": { label: "View aggregate reporting", roles: ["consular_officer", "mission_admin", "platform_admin"] },
};

export function can(role: Role, permission: Permission) {
  return PERMISSIONS[permission].roles.includes(role);
}

export const NOTICES: Record<string, string> = {
  arrival: "Arrival confirmed. Your trip is now active.",
  extended: "Your departure date has been updated.",
  closed: "Trip closed. Your travel history has been kept.",
  cancelled: "Registration cancelled.",
  saved: "Your changes have been saved.",
  created: "Your registration has been submitted.",
  booked: "Your appointment is booked.",
  appt_cancelled: "Your appointment has been cancelled.",
  case_created: "Your request has been submitted.",
  responded: "Thank you. Your response has been recorded.",
  feedback: "Thank you. Your feedback has been sent to the mission.",
  all_read: "All alerts marked as read.",
  deletion: "Deletion request recorded. It is subject to legal retention requirements.",
  deletion_cancelled: "Deletion request withdrawn.",
  alert_draft: "Alert draft saved. It has not been sent to anyone.",
  alert_published: "Alert published. Delivery is simulated in this demo.",
  alert_expired: "Alert expired. Citizens will no longer see it as active.",
  crisis_sent: "Wellbeing check sent (simulated delivery). Responses will appear below.",
  crisis_closed: "Wellbeing check closed. Shared locations were purged.",
};

export type GuidanceArticle = {
  id: string;
  title: string;
  updated: string;
  summary: string;
  steps: string[];
  note?: string;
};

/** Demo guidance for Kenyans abroad. Real content must be written, reviewed and dated by the Ministry. */
export const GUIDANCE: GuidanceArticle[] = [
  {
    id: "lost-passport",
    title: "Lost or stolen Kenyan passport",
    updated: "2026-08-12",
    summary: "What to do if your passport or travel document is lost, stolen or destroyed abroad.",
    steps: [
      "If it was stolen, report it to the local police and keep a copy of the report.",
      "Gather any copy or photo of your passport, your national ID or birth certificate, your travel plans and passport-style photographs if you can.",
      "Submit a request under 'Lost or stolen passport', or book an appointment for an emergency travel document at your mission.",
      "Check the visa, residence and exit rules of the country you are in. A mission cannot waive local immigration requirements.",
    ],
    note: "Emergency travel documents are usually valid for a limited journey and may take time to issue. Process and fees are confirmed by the Ministry.",
  },
  {
    id: "labour",
    title: "Problems with an employer or recruitment agency",
    updated: "2026-08-04",
    summary: "For Kenyans working abroad who face unpaid wages, abuse, a withheld passport, unsafe housing or a contract that does not match what was promised.",
    steps: [
      "If you are in danger or being harmed, contact local emergency services first. Move to a safe place if you can.",
      "Keep copies or photos of your contract, job offer, payslips, messages with your employer or agency, and your employer's and agency's details.",
      "Submit a request under 'Employment or labour problem'. Tell us a safe way and time to contact you. We will not contact your employer without discussing it with you first.",
      "In many countries a withheld passport is unlawful. Tell us if your employer is keeping yours.",
      "The mission cannot act as your lawyer or force an employer to pay, but it can advise on options, liaise with local authorities and refer you to welfare or legal support where available.",
    ],
    note: "Do not pay anyone who offers to 'fix' your case for money. Embassy staff never ask for payment through personal accounts.",
  },
  {
    id: "death-abroad",
    title: "Death of a Kenyan abroad",
    updated: "2026-07-21",
    summary: "How to report a death, register it, and understand the options for repatriation of remains.",
    steps: [
      "Family members, employers or friends can report the death by submitting a request under 'Death of a Kenyan abroad'.",
      "Local authorities issue the official death documents. The mission can explain how to get them certified and registered for use in Kenya.",
      "Repatriation or burial abroad is usually arranged by the family, an insurer or an employer. The mission can advise on procedures and required documents but does not normally pay costs.",
      "We will only share information with people who can show they are next of kin or have the family's agreement.",
    ],
    note: "Our deepest condolences. Take your time — the team will explain each step in plain language.",
  },
  {
    id: "detention",
    title: "Arrest or detention",
    updated: "2026-07-02",
    summary: "If you or a family member has been arrested or detained abroad.",
    steps: [
      "Ask to contact the Kenyan mission. Staff can often visit and share lists of local lawyers, but cannot act as your lawyer.",
      "Stay calm, be polite and do not sign documents you do not understand.",
      "A family member can submit a request on your behalf. We will check consent before sharing information.",
      "The mission cannot get you released or pay legal fees, and cannot interfere with local legal processes.",
    ],
  },
  {
    id: "medical",
    title: "Medical emergencies",
    updated: "2026-07-14",
    summary: "Getting help when you or a family member is seriously ill or injured abroad.",
    steps: [
      "Call local emergency services first. The mission is not an emergency medical provider.",
      "Contact your travel or health insurer as soon as possible, as they can approve treatment and transport.",
      "Tell the mission if you want us to help contact your family in Kenya. We will only do so with your consent.",
      "Keep receipts and medical reports. They may be needed by your insurer.",
    ],
  },
  {
    id: "evacuation",
    title: "Crisis and evacuation",
    updated: "2026-06-28",
    summary: "How the mission communicates during natural disasters, unrest or other emergencies.",
    steps: [
      "Keep your registration and contact details up to date so we can send verified alerts.",
      "Follow instructions from local authorities and check verified embassy alerts only.",
      "Respond to wellbeing checks with 'Safe', 'Need help' or 'Not in the affected area'. Sharing your location is always optional.",
      "Evacuation or assisted departure is not guaranteed. Make your own contingency plans and keep a valid travel document ready.",
    ],
    note: "Not receiving a reply from you never means we assume you are missing or in danger.",
  },
  {
    id: "crime",
    title: "Victim of crime",
    updated: "2026-07-09",
    summary: "Support if you have been a victim of crime or feel unsafe.",
    steps: [
      "Move to a safe place and contact local emergency services if you are in danger.",
      "Report the crime to local police and request a copy of the report.",
      "Submit a request for consular support if you need advice, contact with family, or help replacing documents.",
    ],
  },
  {
    id: "registration",
    title: "What travel registration does and does not do",
    updated: "2026-08-20",
    summary: "Understand the limits of registering your travel with the mission.",
    steps: [
      "It helps the mission contact you with verified alerts and gives staff context if you ask for help.",
      "It does not replace visas, residence permits or any immigration registration required locally.",
      "It does not guarantee assistance. Support depends on each mission's services and capabilities.",
      "It does not replace local emergency services.",
    ],
  },
];

export const EMERGENCY_DISCLAIMER =
  "Online requests may not be monitored continuously. If there is immediate danger, contact local emergency services or the embassy's published emergency line.";

export const DEMO_NOTICE =
  "This is a pilot prototype prepared for Kenya's Ministry of Foreign Affairs. It uses sample data and is not yet operated by the Ministry. Mission names, locations and jurisdictions follow the Ministry's published directory; addresses, phone numbers, emails and opening hours are placeholders until the Ministry confirms them.";

export const DIRECTORY_NOTE =
  "Mission names, host cities and countries served are based on the Ministry's published directory of missions. Addresses, phone numbers, emails, websites, opening hours and verification dates are placeholders and must be confirmed by the Ministry before launch.";
