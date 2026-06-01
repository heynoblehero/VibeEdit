// Minimal HTML email templates. Dark theme, brand-aligned.
// Use inline styles for max client compatibility (Gmail strips <style> sometimes).

const ACCENT = "#d6ff3a";
const BG = "#07070b";
const FG = "#e8e8ee";
const MUTED = "#9999a8";
const BORDER = "#23232f";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "https://vibevideoedit.com"
  );
}

function wrap(content: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BG};font-family:Inter,system-ui,sans-serif;color:${FG};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#15151f;border:1px solid ${BORDER};border-radius:16px;padding:32px;">
<tr><td>
<div style="font-weight:900;font-size:18px;margin-bottom:24px;letter-spacing:-0.02em;">
<span style="color:${FG};">vibe</span><span style="color:${ACCENT};">edit</span>
<span style="background:${ACCENT};color:#000;padding:2px 6px;border-radius:3px;font-size:10px;text-transform:uppercase;margin-left:4px;">video</span>
</div>
${content}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">
You're getting this because you have an account at VibeEdit Video.<br/>
<a href="${siteUrl()}/app/settings/account" style="color:${MUTED};">Manage email preferences</a>
</div>
</td></tr></table></td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#000;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none;">${label}</a>`;
}

export function verifyEmailEmail(args: { name: string; url: string }) {
  const body = `
<h1 style="font-size:24px;margin:0 0 12px;">Confirm your email, ${args.name}.</h1>
<p style="color:${MUTED};margin:0 0 24px;">Tap the button to verify your email and unlock rendering on VibeEdit Video. The link expires in 24 hours.</p>
${button(args.url, "Verify email")}
<p style="margin:24px 0 0;font-size:14px;color:${MUTED};">Didn't sign up? You can safely ignore this — your address won't be used.</p>
`;
  return wrap(body);
}

export function welcomeEmail(args: { name: string }) {
  const body = `
<h1 style="font-size:24px;margin:0 0 12px;">Welcome, ${args.name}.</h1>
<p style="color:${MUTED};margin:0 0 24px;">VibeEdit Video is Claude Code for video. Prompt the agent, watch it build, render to MP4. Three steps.</p>
${button(`${siteUrl()}/app/projects`, "Open the editor")}
<p style="margin:24px 0 0;font-size:14px;color:${MUTED};">Stuck? Reply to this email — a human reads it.</p>
`;
  return wrap(body);
}

export function reengageNoProjectEmail(args: { name: string }) {
  const body = `
<h1 style="font-size:22px;margin:0 0 12px;">Still curious about VibeEdit?</h1>
<p style="color:${MUTED};margin:0 0 16px;">You signed up a week ago, ${args.name}, but haven't shipped a project yet. The fastest way in: click a sample prompt — first MP4 takes about 90 seconds.</p>
${button(`${siteUrl()}/app/projects`, "Try a sample prompt")}
<p style="margin:24px 0 0;font-size:13px;color:${MUTED};">Reply if you got stuck — I read every message.</p>
`;
  return wrap(body);
}

export function reengageNoRenderEmail(args: { name: string }) {
  const body = `
<h1 style="font-size:22px;margin:0 0 12px;">Ship one video this week.</h1>
<p style="color:${MUTED};margin:0 0 16px;">${args.name}, you have a project but no renders yet. The MP4 is the magic moment — let's get you there.</p>
${button(`${siteUrl()}/app/projects`, "Open the editor")}
<p style="margin:24px 0 0;font-size:13px;color:${MUTED};">Hit ⌘R in the editor when you're ready to render. Reply with the error if anything's broken.</p>
`;
  return wrap(body);
}

export function renderDoneEmail(args: { projectName: string; downloadUrl: string }) {
  const body = `
<h1 style="font-size:22px;margin:0 0 12px;">Your render is ready.</h1>
<p style="color:${MUTED};margin:0 0 16px;"><strong style="color:${FG};">${args.projectName}</strong> just finished rendering.</p>
${button(args.downloadUrl, "Download .mp4")}
<p style="margin:24px 0 0;font-size:14px;color:${MUTED};">The link is valid for 24 hours.</p>
`;
  return wrap(body);
}

export function trialEndingEmail(args: { daysLeft: number; plan: string }) {
  const body = `
<h1 style="font-size:22px;margin:0 0 12px;">Your trial ends in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}.</h1>
<p style="color:${MUTED};margin:0 0 20px;">You're on the ${args.plan} trial. Keep going or cancel — your call.</p>
${button(`${siteUrl()}/app/billing`, "Manage subscription")}
`;
  return wrap(body);
}

export function billingReceiptEmail(args: {
  amount: string;
  plan: string;
  nextBillingDate: string;
}) {
  const body = `
<h1 style="font-size:22px;margin:0 0 12px;">Receipt — ${args.amount}</h1>
<p style="color:${MUTED};margin:0 0 8px;">${args.plan} plan</p>
<p style="color:${MUTED};margin:0 0 24px;">Next charge: ${args.nextBillingDate}</p>
${button(`${siteUrl()}/app/billing`, "View billing")}
`;
  return wrap(body);
}

export function renderFailedEmail(args: { projectName: string; errorMessage: string }) {
  const body = `
<h1 style="font-size:22px;margin:0 0 12px;">A render failed.</h1>
<p style="color:${MUTED};margin:0 0 16px;"><strong style="color:${FG};">${args.projectName}</strong></p>
<pre style="background:#0a0a14;padding:12px;border-radius:8px;font-size:12px;color:${MUTED};white-space:pre-wrap;">${args.errorMessage.slice(0, 800)}</pre>
${button(`${siteUrl()}/app/renders`, "View renders")}
<p style="margin:24px 0 0;font-size:14px;color:${MUTED};">Reply to this email if you need help — we'll dig in.</p>
`;
  return wrap(body);
}
