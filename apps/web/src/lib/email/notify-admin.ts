// Operational alerts to the operators (ADMIN_EMAILS): new signups, paid trials,
// inbound support messages. Reuses the existing Resend layer (sendEmail) and the
// same admin allowlist that gates the console, so whoever can see the dashboard
// gets pinged. Fire-and-forget: never throws into the request path.

import { adminEmails } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import { adminAlertEmail } from "@/lib/email/templates";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "https://vibevideoedit.com"
  );
}

type AdminAlert = {
  // Prefixed onto the subject line so alerts are filterable in an inbox.
  tag: "signup" | "trial" | "payment" | "support";
  subject: string;
  title: string;
  rows: Array<{ label: string; value: string }>;
  // Admin console tab to deep-link into (e.g. "users", "billing", "support").
  adminTab?: string;
  ctaLabel?: string;
};

// Sends one email per configured admin address. Swallows all errors — an alert
// failing must never break the signup / webhook / support flow that triggered
// it. Call with `void notifyAdmin(...)` from request handlers.
export async function notifyAdmin(alert: AdminAlert): Promise<void> {
  const recipients = adminEmails();
  if (recipients.length === 0) return;

  const ctaHref = alert.adminTab
    ? `${siteUrl()}/admin?tab=${alert.adminTab}`
    : `${siteUrl()}/admin`;
  const html = adminAlertEmail({
    title: alert.title,
    rows: alert.rows,
    ctaHref,
    ctaLabel: alert.ctaLabel,
  });
  const subject = `[VibeEdit ${alert.tag}] ${alert.subject}`;

  await Promise.all(
    recipients.map((to) =>
      sendEmail({ to, subject, html }).catch((error) => {
        console.error(`[notify-admin] failed for ${to}:`, (error as Error).message);
      }),
    ),
  );
}
