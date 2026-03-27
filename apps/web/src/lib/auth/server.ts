import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	emailAndPassword: { enabled: true },
	session: {
		cookieCache: { enabled: true, maxAge: 60 * 60 },
	},
});

export type Auth = typeof auth;
