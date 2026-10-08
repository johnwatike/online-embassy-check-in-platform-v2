import type { Metadata } from "next";
import Link from "next/link";
import { TripStatusBadge, WellbeingBadge, dateRange, tripTitle } from "@/components/citizen-bits";
import { ButtonLink, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { requireCitizen } from "@/lib/auth";
import { getUserTrips } from "@/lib/data";
import { PURPOSES } from "@/lib/constants";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const { user } = await requireCitizen();
  const trips = await getUserTrips(user.id);
  const current = trips.filter((t) => t.status === "active" || t.status === "planned");
  const past = trips.filter((t) => t.status === "closed" || t.status === "cancelled");
  function tripList(list: typeof trips) {
    return (
    <ul className="grid gap-4 md:grid-cols-2">
      {list.map((t) => (
        <li key={t.id}>
          <Card className="h-full">
            <div className="flex flex-wrap items-center gap-2"><TripStatusBadge status={t.status} />{t.wellbeingStatus && t.status === "active" && <WellbeingBadge status={t.wellbeingStatus} />}</div>
            <h3 className="mt-2 text-xl font-semibold text-navy-950"><Link className="underline decoration-navy-300 underline-offset-4 hover:decoration-teal-700" href={`/app/trips/${t.id}`}>{tripTitle(t)}</Link></h3>
            <p className="text-navy-700">{t.destinations.map((d) => d.region).filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-sm text-navy-700">{dateRange(t.startsOn, t.endsOn)}</p>
            <p className="mt-1 text-xs text-navy-600">{PURPOSES[t.purpose] ?? t.purpose} · {t.reference}</p>
          </Card>
        </li>
      ))}
    </ul>
    );
  }
  return (
    <div className="mx-auto max-w-5xl">
      <Flash notice={notice} />
      <PageHeader title="My trips" description="Current, upcoming and past registrations. Closing a trip never deletes its history." actions={<ButtonLink href="/app/trips/new" variant="teal">Check in for a trip</ButtonLink>} />
      <h2 className="mb-3 text-lg font-semibold text-navy-950">Current and upcoming</h2>
      {current.length ? tripList(current) : <EmptyState title="No current trips" icon="🧳" action={<ButtonLink href="/app/trips/new" variant="teal">Check in</ButtonLink>}>Register a trip so the embassy can reach you with relevant alerts.</EmptyState>}
      {past.length > 0 && (<><h2 className="mb-3 mt-8 text-lg font-semibold text-navy-950">Past trips</h2>{tripList(past)}</>)}
    </div>
  );
}
