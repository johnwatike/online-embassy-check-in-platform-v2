/**
 * One-off migration: copy all rows from the development PostgreSQL database
 * into the SQLite file (data/app.db), preserving ids and values.
 * Run with: node scripts/migrate-to-sqlite.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import Database from "better-sqlite3";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlite = new Database(path.join(root, "data", "app.db"));
sqlite.pragma("journal_mode = DELETE");
sqlite.pragma("foreign_keys = OFF");

const pool = new pg.Pool({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });

// Insertion order follows foreign-key dependencies.
const TABLES = [
  "missions",
  "mission_jurisdictions",
  "users",
  "citizen_profiles",
  "emergency_contacts",
  "notification_preferences",
  "trips",
  "trip_destinations",
  "trip_events",
  "dependants",
  "wellbeing_updates",
  "alerts",
  "alert_reads",
  "notifications",
  "assistance_cases",
  "case_attachments",
  "case_messages",
  "case_notes",
  "case_events",
  "appointments",
  "crisis_events",
  "crisis_responses",
  "audit_events",
  "feedback",
];

// Columns that hold JSON (stored as text in SQLite).
const JSON_COLUMNS = new Set(["missions.services"]);

// Postgres `date` columns come back as JS Date objects but must be stored as YYYY-MM-DD strings.
const DATE_ONLY_COLUMNS = new Set([
  "trips.starts_on",
  "trips.ends_on",
  "trip_destinations.arrival_date",
  "trip_destinations.departure_date",
]);

let total = 0;
for (const table of TABLES) {
  const cols = sqlite.prepare(`pragma table_info(${table})`).all().map((c) => c.name);
  if (cols.length === 0) throw new Error(`table ${table} missing in sqlite`);
  const { rows } = await pool.query(`select * from ${table}`);
  if (rows.length === 0) {
    console.log(`${table}: 0 rows`);
    continue;
  }
  const insert = sqlite.prepare(`insert into ${table} (${cols.join(",")}) values (${cols.map((c) => `@${c}`).join(",")})`);
  const runAll = sqlite.transaction((rs) => {
    for (const row of rs) {
      const values = {};
      for (const col of cols) {
        let v = row[col] ?? null;
        if (v instanceof Date) v = DATE_ONLY_COLUMNS.has(`${table}.${col}`) ? v.toISOString().slice(0, 10) : Math.floor(v.getTime() / 1000);
        else if (typeof v === "boolean") v = v ? 1 : 0;
        else if (v !== null && typeof v === "object" && JSON_COLUMNS.has(`${table}.${col}`)) v = JSON.stringify(v);
        else if (v !== null && typeof v === "object") v = JSON.stringify(v);
        values[col] = v;
      }
      insert.run(values);
    }
  });
  runAll(rows);
  total += rows.length;
  console.log(`${table}: ${rows.length} rows`);
}

await pool.end();
sqlite.pragma("foreign_keys = ON");
sqlite.close();
console.log(`Migrated ${total} rows into data/app.db`);
