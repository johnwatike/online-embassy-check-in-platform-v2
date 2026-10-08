import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { emergencyContacts } from "@/db/schema";
import { LOCAL_EMERGENCY } from "./constants";
import { currentDestination, getContacts, getUserTrips, pickCurrentTrip } from "./data";
import { getProfile } from "./auth";
import { UUID } from "./validation";

export async function buildCardData(userId: string, tripId?: string, contactId?: string) {
  const [trips, contacts, profile] = await Promise.all([getUserTrips(userId), getContacts(userId), getProfile(userId)]);
  const open = trips.filter((t) => t.status === "active" || t.status === "planned");
  const trip = (tripId && UUID.test(tripId) ? trips.find((t) => t.id === tripId) : undefined) ?? pickCurrentTrip(trips);
  const dest = trip ? currentDestination(trip) : undefined;
  let contact = contacts.find((c) => c.id === contactId) ?? null;
  if (!contact && contactId === undefined) contact = contacts[0] ?? null;
  if (contactId === "none") contact = null;
  void and;
  void eq;
  void emergencyContacts;
  return {
    name: profile?.fullName ?? "",
    trip,
    dest,
    mission: dest?.mission ?? null,
    local: dest ? LOCAL_EMERGENCY[dest.country] ?? null : null,
    contact,
    contacts,
    open,
    updatedAt: new Date(),
  };
}
