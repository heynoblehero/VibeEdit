import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

// To switch to Postgres (Neon) for production:
//   1. bun add @neondatabase/serverless drizzle-orm
//   2. Set DATABASE_URL=postgres://... in your environment
//   3. Replace this file's imports:
//        import { neon } from "@neondatabase/serverless";
//        import { drizzle } from "drizzle-orm/neon-http";
//        export const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
//   4. Update drizzle.config.ts dialect to "postgresql"
//   5. bun run db:migrate

const DB_PATH = process.env.DATABASE_PATH || resolve(process.cwd(), "storage", "app.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
