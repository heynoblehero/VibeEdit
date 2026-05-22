import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
	throw new Error(
		"BETTER_AUTH_SECRET must be set in production — sessions would be forgeable.",
	);
}

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite", schema }),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		minPasswordLength: 6,
	},
	secret: process.env.BETTER_AUTH_SECRET || "dev-only-secret-replace-me",
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
