import type { RoutingEntry } from "./types";

/** Pure function (safe for client bundles): which mission is responsible for a destination? */
export function resolveRouting(routing: RoutingEntry[], country: string, region?: string | null): RoutingEntry | null {
  const matches = routing.filter((r) => r.country.toLowerCase() === country.trim().toLowerCase());
  if (!matches.length) return null;
  const reg = (region ?? "").toLowerCase();
  const regional = matches.find((m) => m.region && reg.includes(m.region.toLowerCase()));
  return regional ?? matches.find((m) => !m.region) ?? null;
}

export function regionMatches(alertRegion: string | null | undefined, destRegion: string | null | undefined) {
  if (!alertRegion) return true;
  return (destRegion ?? "").toLowerCase().includes(alertRegion.toLowerCase());
}
