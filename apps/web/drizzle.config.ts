import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

export default defineConfig({
	schema: "./src/lib/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.DATABASE_URL || `file:${resolve("./storage/app.db")}`,
	},
});
