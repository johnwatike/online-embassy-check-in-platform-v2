import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updateTrip } from "@/app/actions/citizen";
import { TripWizard } from "@/components/trip-wizard";
import { PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { getPrefs, getTripDependants, getUserTrip } from "@/lib/data";
import { todayStr } from "@/lib/format";
import { loadRouting } from "@/lib/services";

export const metadata: Metadata = { title: "Edit trip" };

export default async function EditTrip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireCitizen();
  const trip = await getUserTrip(user.id, id);
  if (!trip) notFound();
  if (!["planned", "active"].includes(trip.status)) redirect(`/app/trips/${id}`);
  const [routing, prefs, deps] = await Promise.all([loadRouting(), getPrefs(user.id), getTripDependants(id)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit trip details" eyebrow={`Reference ${trip.reference}`} description="Correct your dates, destination or contact details. Your earlier details stay in the trip history." />
      <TripWizard
        mode="edit"
        routing={routing}
        action={updateTrip.bind(null, id)}
        today={todayStr()}
        cancelHref={`/app/trips/${id}`}
        initial={{
          stage: trip.status === "active" ? "arrived" : "planning",
          purpose: trip.purpose,
          destinations: trip.destinations.map((d) => ({ country: d.country, region: d.region ?? "", arrivalDate: d.arrivalDate, departureDate: d.departureDate ?? "" })),
          accommodation: trip.accommodation ?? "",
          contactPhone: trip.contactPhone ?? "",
          contactEmail: trip.contactEmail ?? "",
          prefs: { email: prefs?.email ?? true, sms: prefs?.sms ?? false, push: prefs?.push ?? false, reminders: prefs?.reminders ?? true },
          existingDependants: deps.map((d) => ({ fullName: d.fullName, relationship: d.relationship })),
        }}
      />
    </div>
  );
}
