import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, assistanceCases, caseMessages, citizenProfiles, dependants, emergencyContacts, notificationPreferences, trips, tripDestinations, wellbeingUpdates } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/services";

export const dynamic = "force-dynamic";

/** Data export for the signed-in citizen. Internal staff notes are never included. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "citizen") return new Response("Unauthorized", { status: 401 });
  const [profile] = await db.select().from(citizenProfiles).where(eq(citizenProfiles.userId, user.id));
  const myTrips = await db.select().from(trips).where(eq(trips.userId, user.id));
  const tripIds = myTrips.map((t) => t.id);
  const cases = await db.select().from(assistanceCases).where(eq(assistanceCases.userId, user.id));
  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, createdAt: user.createdAt },
    profile,
    emergencyContacts: await db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, user.id)),
    notificationPreferences: (await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id)))[0] ?? null,
    trips: myTrips,
    tripDestinations: tripIds.length ? await db.select().from(tripDestinations).where(inArray(tripDestinations.tripId, tripIds)).orderBy(asc(tripDestinations.position)) : [],
    dependants: await db.select().from(dependants).where(eq(dependants.userId, user.id)),
    wellbeingUpdates: await db.select().from(wellbeingUpdates).where(eq(wellbeingUpdates.userId, user.id)),
    assistanceCases: cases.map(({ assignedToId: _a, ...c }) => c),
    caseMessages: cases.length ? await db.select().from(caseMessages).where(inArray(caseMessages.caseId, cases.map((c) => c.id))) : [],
    appointments: await db.select().from(appointments).where(eq(appointments.userId, user.id)),
  };
  await audit(user, "privacy.export", "user", user.id, "Citizen exported their data");
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="embassy-connect-my-data.json"', "Cache-Control": "private, no-store" },
  });
}
