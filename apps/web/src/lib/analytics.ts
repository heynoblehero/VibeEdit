import { track } from "@vercel/analytics";

/**
 * Track key funnel events.
 * These are the metrics that matter for revenue:
 *
 * signup → first_project → first_upload → first_ai_message →
 * first_export → credits_depleted → checkout_started → purchase
 */
export function trackEvent(
	event:
		| "signup"
		| "login"
		| "project_created"
		| "file_uploaded"
		| "ai_message_sent"
		| "export_started"
		| "export_completed"
		| "credits_depleted"
		| "checkout_started"
		| "purchase_completed"
		| "storyboard_opened",
	properties?: Record<string, string | number | boolean>,
) {
	try {
		track(event, properties);
	} catch {
		// Analytics should never break the app
	}
}
