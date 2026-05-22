import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendEmail } from "./email/send";
import { verifyEmailEmail } from "./email/templates";

// Production safety: refuse to start with a forgeable secret. Skip during the
// Next.js build phase — env vars from Dokku config aren't loaded then, and we
// don't sign sessions during static analysis.
const isBuildPhase =
	process.env.NEXT_PHASE === "phase-production-build" ||
	process.env.NEXT_PHASE === "phase-export";
if (
	process.env.NODE_ENV === "production" &&
	!isBuildPhase &&
	!process.env.BETTER_AUTH_SECRET
) {
	throw new Error(
		"BETTER_AUTH_SECRET must be set in production — sessions would be forgeable.",
	);
}

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite", schema }),
	emailAndPassword: {
		enabled: true,
		// We still autoSignIn so the user lands in the app immediately, but
		// requireEmailVerification gates the sensitive paths (render, billing
		// portal) via the middleware-level check on session.user.emailVerified.
		autoSignIn: true,
		requireEmailVerification: true,
		minPasswordLength: 6,
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		expiresIn: 24 * 60 * 60, // 24 hours
		async sendVerificationEmail({ user, url }) {
			await sendEmail({
				to: user.email,
				subject: "Confirm your VibeEdit Video email",
				html: verifyEmailEmail({ name: user.name || user.email, url }),
			});
		},
	},
	secret: process.env.BETTER_AUTH_SECRET || "dev-only-secret-replace-me",
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
