/*
 * Central error logger.
 *
 * Today: persists to the `errorLog` table so the admin dashboard can show
 * recent failures, and falls through to console.error so logs still surface.
 *
 * Future: when SENTRY_DSN is set, also forwards to Sentry (we only have to
 * touch this one file). The call sites stay the same.
 */

import { nanoid } from "nanoid";
import { db } from "../db";
import { errorLog } from "../db/schema";

type LogContext = Record<string, string | number | boolean | null | undefined>;

export function logError(
	source: string,
	error: unknown,
	context?: LogContext,
): void {
	const message =
		error instanceof Error ? error.message : String(error || "unknown");
	const stack = error instanceof Error ? error.stack : null;
	// Console first — never swallow a logging failure.
	console.error(`[${source}]`, message, context || "");
	try {
		db.insert(errorLog)
			.values({
				id: nanoid(12),
				source,
				message: message.slice(0, 4000),
				stack: stack ? stack.slice(0, 8000) : null,
				context: context ? JSON.stringify(context).slice(0, 2000) : null,
				createdAt: new Date(),
			})
			.run();
	} catch (writeError) {
		console.error("[logger] db write failed", writeError);
	}
	// TODO: forward to Sentry when SENTRY_DSN is set. Wrap so a failure
	// here never breaks the parent request.
}
