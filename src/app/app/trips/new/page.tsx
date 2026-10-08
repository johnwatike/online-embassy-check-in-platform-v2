import type { Metadata } from "next";
import { createTrip } from "@/app/actions/citizen";
import { TripWizard } from "@/components/trip-wizard";
import { PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { getPrefs } from "@/lib/data";
import { todayStr } from "@/lib/format";
import { loadRouting } from "@/lib/services";

export const metadata: Metadata = { title: "Check in" };

export default async function NewTrip() {
  const { user, profile } = await requireCitizen();
  const [routing, prefs] = await Promise.all([loadRouting(), getPrefs(user.id)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Check in" eyebrow="Travel registration" description="Register before you travel, or check in after you arrive. It takes about two minutes. Only the destination and dates are required." />
      <TripWizard
        mode="create"
        routing={routing}
        action={createTrip}
        today={todayStr()}
        cancelHref="/app"
        initial={{
          stage: "planning",
          purpose: "",
          destinations: [],
          accommodation: "",
          contactPhone: `${profile.phoneDial} ${profile.phoneNumber}`,
          contactEmail: user.email,
          prefs: { email: prefs?.email ?? true, sms: prefs?.sms ?? false, push: prefs?.push ?? false, reminders: prefs?.reminders ?? true },
          existingDependants: [],
        }}
      />
    </div>
  );
}
