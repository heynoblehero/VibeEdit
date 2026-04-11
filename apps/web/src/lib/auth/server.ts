import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/lib/db";

export const auth = betterAuth({
	baseURL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
	trustedOrigins: [
		"https://vibevideoedit.com",
		"https://www.vibevideoedit.com",
		process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
	],
	secret: process.env.BETTER_AUTH_SECRET || "vibeedit-local-dev-secret-at-least-32-chars-long",
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	rateLimit: {
		window: 60,
		max: 10,
	},
});

export type Auth = typeof auth;
