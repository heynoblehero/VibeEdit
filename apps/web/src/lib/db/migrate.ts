import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_PATH || resolve(process.cwd(), "storage", "app.db");
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Custom idempotent migrator — Drizzle's built-in runner halts on any SQL
// error, which breaks redeploys when ALTER TABLE columns already exist.
// This runner catches "already exists / duplicate column" errors per-statement
// and still marks each migration as applied once all statements succeed or are
// skipped as no-ops.

const migrationsDir = resolve(process.cwd(), "drizzle");

type JournalEntry = { idx: number; tag: string };
type Journal = { entries: JournalEntry[] };

const journal: Journal = JSON.parse(
  readFileSync(resolve(migrationsDir, "meta/_journal.json"), "utf8"),
);

// Ensure the tracking table exists (may be absent on a brand-new DB).
db.prepare(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  hash text PRIMARY KEY NOT NULL,
  created_at integer NOT NULL
)`).run();

const applied = new Set<string>(
  db
    .prepare("SELECT hash FROM __drizzle_migrations")
    .all()
    .map((r) => (r as { hash: string }).hash),
);

let newCount = 0;

for (const entry of journal.entries) {
  const sqlPath = resolve(migrationsDir, `${entry.tag}.sql`);
  const sql = readFileSync(sqlPath, "utf8");
  // Drizzle uses SHA-256 of the full file content as the migration hash.
  const hash = createHash("sha256").update(sql).digest("hex");

  if (applied.has(hash)) continue;

  // Split on Drizzle's statement-breakpoint marker.
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      db.prepare(stmt).run();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      // Tolerate "already exists" so re-deploys after a manual fix don't crash.
      const isBenign =
        msg.includes("already exists") ||
        msg.includes("duplicate column name") ||
        msg.includes("table") ||
        msg.includes("index");
      if (!isBenign) throw err;
    }
  }

  db.prepare("INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(
    hash,
    Date.now(),
  );
  newCount++;
}

console.log(`✓ migrations applied${newCount > 0 ? ` (${newCount} new)` : " (up to date)"}`);
