import cities, { type GeoCity } from "all-the-cities";

/**
 * Offline geocoder for the "where will you stay" fields.
 * Bundles the `all-the-cities` dataset (GeoNames-derived, ~135k places) so the pilot works
 * without calling any external geocoding service. Given the traveller's free-text hotel
 * address / location it picks the best-matching place in the destination country (largest
 * population wins), falling back to that country's capital, marked as approximate.
 */

export type GeoPick = {
  place: string;
  lat: number;
  lng: number;
  kind: "match" | "capital";
};

/** ISO 3166-1 alpha-2 codes for every country offered in the check-in form. */
export const COUNTRY_ISO: Record<string, string> = {
  Argentina: "AR", Australia: "AU", Austria: "AT", Bangladesh: "BD", Belgium: "BE", Benin: "BJ", Bhutan: "BT", Bolivia: "BO", Brazil: "BR", Brunei: "BN", Bulgaria: "BG",
  "Burkina Faso": "BF", Cambodia: "KH", Cameroon: "CM", Canada: "CA", Chile: "CL", China: "CN", "Costa Rica": "CR", Czechia: "CZ", Denmark: "DK", Egypt: "EG", "El Salvador": "SV",
  "Equatorial Guinea": "GQ", Eritrea: "ER", Estonia: "EE", Eswatini: "SZ", Ethiopia: "ET", Fiji: "FJ", Finland: "FI", France: "FR", Georgia: "GE", Germany: "DE", Ghana: "GH",
  Greece: "GR", Guinea: "GN", Honduras: "HN", Iceland: "IS", India: "IN", Indonesia: "ID", Ireland: "IE", Italy: "IT", Japan: "JP", Jordan: "JO", Kiribati: "KI", Kuwait: "KW",
  Laos: "LA", Latvia: "LV", Lesotho: "LS", Liberia: "LR", Lithuania: "LT", Malawi: "MW", Malaysia: "MY", Maldives: "MV", Malta: "MT", Mauritius: "MU", Mexico: "MX",
  Mongolia: "MN", Myanmar: "MM", Namibia: "NA", Nauru: "NR", Nepal: "NP", Netherlands: "NL", "New Zealand": "NZ", Nicaragua: "NI", Nigeria: "NG", "North Macedonia": "MK",
  Norway: "NO", Oman: "OM", Pakistan: "PK", Palestine: "PS", "Papua New Guinea": "PG", Paraguay: "PY", Peru: "PE", Philippines: "PH", Poland: "PL", Portugal: "PT",
  Qatar: "QA", Romania: "RO", Russia: "RU", Rwanda: "RW", Samoa: "WS", "Saudi Arabia": "SA", Seychelles: "SC", "Sierra Leone": "SL", Singapore: "SG", Somalia: "SO",
  "South Africa": "ZA", "South Korea": "KR", "South Sudan": "SS", Spain: "ES", "Sri Lanka": "LK", Sweden: "SE", Switzerland: "CH", Tanzania: "TZ", Thailand: "TH",
  "Timor-Leste": "TL", Togo: "TG", Turkey: "TR", Uganda: "UG", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US", Uruguay: "UY", Vanuatu: "VU",
  Vietnam: "VN", Zambia: "ZM", Zimbabwe: "ZW",
};

const ISO_NAME = Object.fromEntries(Object.entries(COUNTRY_ISO).map(([name, iso]) => [iso, name]));

type Index = { byCountry: Map<string, GeoCity[]>; capital: Map<string, GeoCity>; global: GeoCity[] };
let index: Index | null = null;

function ensureIndex(): Index {
  if (index) return index;
  const byCountry = new Map<string, GeoCity[]>();
  for (const c of cities) {
    const list = byCountry.get(c.country);
    if (list) list.push(c);
    else byCountry.set(c.country, [c]);
  }
  const capital = new Map<string, GeoCity>();
  for (const [iso, list] of byCountry) {
    list.sort((a, b) => b.population - a.population);
    capital.set(iso, list.find((c) => c.featureCode === "PPLC") ?? list[0]);
  }
  const global = [...cities].sort((a, b) => b.population - a.population);
  index = { byCountry, capital, global };
  return index;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const r4 = (n: number) => Math.round(n * 10000) / 10000;

function pick(c: GeoCity, countryName: string | null, kind: GeoPick["kind"]): GeoPick {
  const suffix = countryName ?? ISO_NAME[c.country];
  return { place: `${c.name}${suffix ? `, ${suffix}` : ""}`, lat: r4(c.loc.coordinates[1]), lng: r4(c.loc.coordinates[0]), kind };
}

/**
 * Best-effort coordinates for free-text like "Rove Downtown, Al Barsha 1, Dubai".
 * Prefers a named place inside `countryName`; falls back to the capital (approximate);
 * without a country, tries the largest matching city worldwide.
 */
export function geocodePlace(query: string, countryName?: string | null): GeoPick | null {
  const idx = ensureIndex();
  const q = norm(query ?? "");
  const iso = countryName ? COUNTRY_ISO[countryName] : undefined;

  if (iso) {
    const list = idx.byCountry.get(iso) ?? [];
    if (q) {
      let best: GeoCity | null = null;
      for (const c of list) {
        const n = norm(c.name);
        if (n.length < 3) continue;
        if (q.includes(n) || n.includes(q)) {
          best = c;
          break; // list is population-sorted: first hit is the biggest match
        }
      }
      if (best) return pick(best, countryName ?? null, "match");
    }
    const cap = idx.capital.get(iso);
    if (cap) return pick(cap, countryName ?? null, "capital");
    return null;
  }

  if (q) {
    for (const c of idx.global) {
      const n = norm(c.name);
      if (n.length >= 4 && q.includes(n)) return pick(c, null, "match");
      if (c.population < 200000) break; // only search well-known places worldwide
    }
  }
  return null;
}
