import "dotenv/config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";
import { resolve } from "node:path";

migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
console.log("✓ migrations applied");
