// Sentry stub — wire @sentry/nextjs here when you flip it on.
// For now this exposes captureException + addBreadcrumb that no-op without DSN.

export function captureException(error: unknown, context?: Record<string, unknown>) {
	if (!process.env.SENTRY_DSN) {
		console.error("[exception]", error, context || "");
		return;
	}
	// When you add @sentry/nextjs:
	// import * as Sentry from "@sentry/nextjs";
	// Sentry.captureException(error, { extra: context });
	console.error("[sentry-stub]", error, context || "");
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
	if (!process.env.SENTRY_DSN) return;
	// Sentry.addBreadcrumb({ message, data });
}
