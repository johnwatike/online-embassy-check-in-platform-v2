/**
 * Local development database: runs a real, self-contained PostgreSQL 18
 * (via the `embedded-postgres` npm package) on 127.0.0.1:5432.
 *
 * Data lives in ./.pgdata (gitignored). The app connects with:
 *   postgresql://postgres:postgres@127.0.0.1:5432/app_db
 *
 * Usage: node scripts/db-server.mjs   (runs until stopped)
 */
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: new URL("../.pgdata", import.meta.url).pathname,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  onLog: (m) => process.stdout.write(`[pg] ${m}\n`),
  onError: (m) => process.stderr.write(`[pg:err] ${String(m)}\n`),
});

if (!existsSync(new URL("../.pgdata", import.meta.url).pathname)) {
  process.stdout.write("[pg] initialising data directory…\n");
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("app_db");
  process.stdout.write("[pg] created database app_db\n");
} catch (err) {
  if (!String(err).includes("already exists")) throw err;
}
process.stdout.write("[pg] ready on postgresql://postgres:postgres@127.0.0.1:5432/app_db\n");

// Keep the process alive while the sandbox runs the app.
setInterval(() => {}, 1 << 30);
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
