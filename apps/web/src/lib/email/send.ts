// Lazy email layer. If RESEND_API_KEY is set, sends via Resend HTTP API.
// Otherwise logs to console (dev mode).

export type EmailMessage = {
	to: string;
	subject: string;
	html: string;
	from?: string;
};

const FROM_DEFAULT =
	process.env.EMAIL_FROM || "VibeEdit Video <noreply@vibeedit.video>";

export async function sendEmail(message: EmailMessage): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	const from = message.from || FROM_DEFAULT;
	if (!apiKey) {
		console.log(
			`[email:dev] would send to ${message.to} — "${message.subject}"`,
		);
		return;
	}
	try {
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: message.to,
				subject: message.subject,
				html: message.html,
			}),
		});
		if (!response.ok) {
			const body = await response.text();
			console.error(
				`[email] Resend ${response.status}: ${body.slice(0, 500)}`,
			);
		}
	} catch (error) {
		console.error(`[email] send failed:`, (error as Error).message);
	}
}
