import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@vibeedit.app";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!resend) {
    console.log(
      `\nEMAIL (dev mode):\nTo: ${to}\nSubject: ${subject}\nBody:\n${html}\n`
    );
    return true;
  }

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
