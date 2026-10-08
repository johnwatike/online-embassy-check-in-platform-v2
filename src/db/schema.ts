import { randomUUID } from "crypto";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Embassy Connect data model (pilot for Kenya's Ministry of Foreign Affairs; all seeded data is sample data).
// Every table has a unique id and created/updated timestamps where it makes sense.
// Storage: SQLite (data/app.db, committed to git). Timestamps are stored as ISO-8601 text.
// Ownership: citizen-owned rows carry `user_id`. Jurisdiction: rows handled by staff
// carry `mission_id`, and staff only see rows for their own mission.
// ---------------------------------------------------------------------------

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull();
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull();
const tstz = (name: string) => integer(name, { mode: "timestamp" });
const plainDate = (name: string) => text(name);

export type Role = "citizen" | "consular_officer" | "mission_admin" | "platform_admin";
export type ServiceDef = {
  id: string;
  name: string;
  description: string;
  documents: string[];
  durationMin: number;
};

export const missions = sqliteTable("missions", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").$type<"embassy" | "high_commission" | "consulate">().notNull().default("embassy"),
  country: text("country").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  timezone: text("timezone").notNull(),
  phone: text("phone").notNull(),
  emergencyPhone: text("emergency_phone").notNull(),
  email: text("email").notNull(),
  website: text("website").notNull(),
  openingHours: text("opening_hours").notNull(),
  services: text("services", { mode: "json" }).$type<ServiceDef[]>().notNull().default([]),
  lastVerifiedAt: tstz("last_verified_at").$defaultFn(() => new Date()).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const missionJurisdictions = sqliteTable(
  "mission_jurisdictions",
  {
    id: id(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    country: text("country").notNull(),
    region: text("region"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jurisdiction_country_idx").on(t.country), index("jurisdiction_mission_idx").on(t.missionId)],
);

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").$type<Role>().notNull().default("citizen"),
    missionId: text("mission_id").references(() => missions.id),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(true),
    deletionRequestedAt: tstz("deletion_requested_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const citizenProfiles = sqliteTable(
  "citizen_profiles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    citizenship: text("citizenship").notNull(),
    phoneDial: text("phone_dial").notNull().default("+1"),
    phoneNumber: text("phone_number").notNull().default(""),
    preferredLanguage: text("preferred_language").notNull().default("English"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("profiles_user_idx").on(t.userId)],
);

export const emergencyContacts = sqliteTable("emergency_contacts", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: integer("email", { mode: "boolean" }).notNull().default(true),
    sms: integer("sms", { mode: "boolean" }).notNull().default(false),
    push: integer("push", { mode: "boolean" }).notNull().default(false),
    urgentOverride: integer("urgent_override", { mode: "boolean" }).notNull().default(true),
    reminders: integer("reminders", { mode: "boolean" }).notNull().default(true),
    reminderFrequency: text("reminder_frequency").notNull().default("monthly"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("notif_prefs_user_idx").on(t.userId)],
);

export type TripStatus = "planned" | "active" | "closed" | "cancelled";
export type WellbeingStatus = "safe" | "plans_changed" | "need_assistance" | "left_country";

export const trips = sqliteTable(
  "trips",
  {
    id: id(),
    reference: text("reference").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<TripStatus>().notNull().default("planned"),
    purpose: text("purpose").notNull(),
    startsOn: plainDate("starts_on").notNull(),
    endsOn: plainDate("ends_on"),
    accommodation: text("accommodation"),
    lodgingName: text("lodging_name"),
    lodgingPlace: text("lodging_place"),
    lodgingLat: real("lodging_lat"),
    lodgingLng: real("lodging_lng"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    arrivalConfirmedAt: tstz("arrival_confirmed_at"),
    closedAt: tstz("closed_at"),
    wellbeingStatus: text("wellbeing_status").$type<WellbeingStatus>(),
    wellbeingUpdatedAt: tstz("wellbeing_updated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("trips_reference_idx").on(t.reference), index("trips_user_idx").on(t.userId)],
);

export const tripDestinations = sqliteTable(
  "trip_destinations",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    country: text("country").notNull(),
    region: text("region"),
    missionId: text("mission_id").references(() => missions.id),
    arrivalDate: plainDate("arrival_date").notNull(),
    departureDate: plainDate("departure_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dest_trip_idx").on(t.tripId), index("dest_mission_idx").on(t.missionId)],
);

export const tripEvents = sqliteTable(
  "trip_events",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("trip_events_trip_idx").on(t.tripId)],
);

export const dependants = sqliteTable("dependants", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  relationship: text("relationship").notNull(),
  birthYear: integer("birth_year"),
  consentConfirmedAt: tstz("consent_confirmed_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const wellbeingUpdates = sqliteTable(
  "wellbeing_updates",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    status: text("status").$type<WellbeingStatus>().notNull(),
    note: text("note"),
    source: text("source").$type<"citizen" | "crisis_response">().notNull().default("citizen"),
    createdAt: createdAt(),
  },
  (t) => [index("wellbeing_trip_idx").on(t.tripId)],
);

export type AlertCategory = "safety" | "travel_guidance" | "service_update" | "crisis";
export type Severity = "info" | "advisory" | "warning" | "critical";

export const alerts = sqliteTable(
  "alerts",
  {
    id: id(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category").$type<AlertCategory>().notNull(),
    severity: text("severity").$type<Severity>().notNull().default("info"),
    country: text("country").notNull(),
    region: text("region"),
    audience: text("audience").$type<"all" | "active" | "planned">().notNull().default("all"),
    status: text("status").$type<"draft" | "published" | "expired">().notNull().default("draft"),
    recipientCount: integer("recipient_count").notNull().default(0),
    crisisEventId: text("crisis_event_id"),
    publishedAt: tstz("published_at"),
    expiresAt: tstz("expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("alerts_mission_idx").on(t.missionId), index("alerts_country_idx").on(t.country)],
);

export const alertReads = sqliteTable(
  "alert_reads",
  {
    alertId: text("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: tstz("read_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.userId] })],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"case" | "appointment" | "crisis" | "trip" | "system">().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    severity: text("severity").$type<Severity>().notNull().default("info"),
    readAt: tstz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export type CaseCategory = "lost_passport" | "medical" | "detention" | "crime" | "labour" | "death" | "crisis_info" | "other";
export type CaseStatus = "submitted" | "under_review" | "awaiting_citizen" | "in_progress" | "resolved";
export type Priority = "low" | "normal" | "high" | "urgent";

export const assistanceCases = sqliteTable(
  "assistance_cases",
  {
    id: id(),
    reference: text("reference").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id),
    category: text("category").$type<CaseCategory>().notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    contactMethod: text("contact_method").$type<"email" | "sms" | "phone">().notNull().default("email"),
    contactDetail: text("contact_detail"),
    citizenUrgency: text("citizen_urgency").$type<"urgent" | "soon" | "routine">().notNull().default("routine"),
    priority: text("priority").$type<Priority>().notNull().default("normal"),
    status: text("status").$type<CaseStatus>().notNull().default("submitted"),
    assignedToId: text("assigned_to_id").references(() => users.id),
    resolutionNote: text("resolution_note"),
    resolvedAt: tstz("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("cases_reference_idx").on(t.reference),
    index("cases_mission_idx").on(t.missionId),
    index("cases_user_idx").on(t.userId),
  ],
);

export const caseAttachments = sqliteTable("case_attachments", {
  id: id(),
  caseId: text("case_id")
    .notNull()
    .references(() => assistanceCases.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  dataBase64: text("data_base64").notNull(),
  createdAt: createdAt(),
});

export const caseMessages = sqliteTable(
  "case_messages",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => assistanceCases.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id),
    authorKind: text("author_kind").$type<"citizen" | "staff">().notNull(),
    kind: text("kind").$type<"message" | "info_request">().notNull().default("message"),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("case_messages_case_idx").on(t.caseId)],
);

export const caseNotes = sqliteTable(
  "case_notes",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => assistanceCases.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("case_notes_case_idx").on(t.caseId)],
);

export const caseEvents = sqliteTable(
  "case_events",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => assistanceCases.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id),
    actorKind: text("actor_kind").$type<"citizen" | "staff" | "system">().notNull(),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    citizenVisible: integer("citizen_visible", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("case_events_case_idx").on(t.caseId)],
);

export type AppointmentStatus = "available" | "booked" | "cancelled" | "attended" | "no_show" | "rescheduled";

export const appointments = sqliteTable(
  "appointments",
  {
    id: id(),
    reference: text("reference"),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull(),
    serviceName: text("service_name").notNull(),
    startsAt: tstz("starts_at").notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    status: text("status").$type<AppointmentStatus>().notNull().default("available"),
    bookedAt: tstz("booked_at"),
    cancelledAt: tstz("cancelled_at"),
    cancelledBy: text("cancelled_by").$type<"citizen" | "staff">(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("appt_mission_idx").on(t.missionId, t.startsAt), index("appt_user_idx").on(t.userId)],
);

export const crisisEvents = sqliteTable("crisis_events", {
  id: id(),
  missionId: text("mission_id")
    .notNull()
    .references(() => missions.id, { onDelete: "cascade" }),
  createdById: text("created_by_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  message: text("message").notNull(),
  country: text("country").notNull(),
  region: text("region"),
  requestLocation: integer("request_location", { mode: "boolean" }).notNull().default(false),
  status: text("status").$type<"active" | "closed">().notNull().default("active"),
  targetedCount: integer("targeted_count").notNull().default(0),
  sentAt: tstz("sent_at").$defaultFn(() => new Date()).notNull(),
  closedAt: tstz("closed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type CrisisAnswer = "safe" | "need_help" | "not_affected";

export const crisisResponses = sqliteTable(
  "crisis_responses",
  {
    id: id(),
    crisisEventId: text("crisis_event_id")
      .notNull()
      .references(() => crisisEvents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    response: text("response").$type<CrisisAnswer>(),
    note: text("note"),
    locationText: text("location_text"),
    locationConsentAt: tstz("location_consent_at"),
    locationRevokedAt: tstz("location_revoked_at"),
    respondedAt: tstz("responded_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("crisis_resp_unique_idx").on(t.crisisEventId, t.userId)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: id(),
    actorId: text("actor_id"),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull(),
    missionId: text("mission_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    // Summaries must never contain sensitive personal data (no notes, descriptions, locations).
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_mission_idx").on(t.missionId)],
);

export const feedback = sqliteTable("feedback", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  missionId: text("mission_id").references(() => missions.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
});
