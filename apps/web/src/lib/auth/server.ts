import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
	baseURL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001",
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
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Reset your VibeEdit password",
				html: `
					<h2>Reset your password</h2>
					<p>Click the link below to reset your password:</p>
					<a href="${url}" style="display:inline-block;padding:12px 24px;background:#C96442;color:white;text-decoration:none;border-radius:8px;">Reset Password</a>
					<p>If you didn't request this, you can ignore this email.</p>
					<p>&mdash; VibeEdit</p>
				`,
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Verify your VibeEdit email",
				html: `
					<h2>Verify your email</h2>
					<p>Click below to verify your email address:</p>
					<a href="${url}" style="display:inline-block;padding:12px 24px;background:#C96442;color:white;text-decoration:none;border-radius:8px;">Verify Email</a>
					<p>&mdash; VibeEdit</p>
				`,
			});
		},
		sendOnSignUp: true,
	},
	session: {
		cookieCache: { enabled: true, maxAge: 60 * 60 },
	},
});

export type Auth = typeof auth;
