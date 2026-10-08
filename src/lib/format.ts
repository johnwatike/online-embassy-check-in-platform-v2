import { randomBytes } from "crypto";

const MONTHS_FMT = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: tz,
    timeZoneName: "short",
  });

/** Date-only strings (YYYY-MM-DD) → "12 May 2026". No timezone shifting. */
export function fmtDate(value: string | Date | null | undefined, empty = "—"): string {
  if (!value) return empty;
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Timestamps → "12 May 2026, 14:03 UTC" or in a named timezone. */
export function fmtDateTime(value: Date | string | null | undefined, tz = "UTC", empty = "—"): string {
  if (!value) return empty;
  const d = typeof value === "string" ? new Date(value) : value;
  return MONTHS_FMT(tz).format(d);
}

export function fmtTime(value: Date, tz = "UTC") {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz, timeZoneName: "short" }).format(value);
}

export function fmtDayLong(value: Date, tz = "UTC") {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(value);
}

export function dayKey(value: Date, tz = "UTC") {
  const p = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).format(value);
  return p; // YYYY-MM-DD
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function addHours(hours: number, from = new Date()) {
  return new Date(from.getTime() + hours * 3600e3);
}

export function addDays(days: number, from = new Date()) {
  const d = new Date(from.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Like addDays, but returns a Date (for timestamp column comparisons). */
export function addDaysDate(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 86400000);
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeRef(prefix: string) {
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += REF_ALPHABET[b % REF_ALPHABET.length];
  return `${prefix}-${s}`;
}

function tzOffsetMs(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock date + time in a named timezone to a UTC Date. */
export function zonedToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(new Date(utc), tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function maskSmall(n: number, suppress: boolean) {
  return suppress && n > 0 && n < 5 ? "<5" : String(n);
}
