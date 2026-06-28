import { PLANS, type PlanId } from "./plans";

// Structured "limit reached" payload shared by the render + chat routes and
// rendered by the <Paywall> client component. The goal is a designed upgrade
// MOMENT, not a raw error: name what they hit, what upgrading unlocks, and
// reassure that nothing they've made is lost.
export type PaywallReason =
  | "render_limit_reached"
  | "render_minutes_exhausted"
  | "cloud_render_exhausted"
  | "chat_limit_reached";

export type PaywallResponse = {
  // Discriminator the client checks to decide whether to show the upgrade
  // moment vs. a generic error toast.
  paywall: true;
  reason: PaywallReason;
  title: string;
  message: string;
  // What the suggested plan unlocks vs. where they are now.
  unlocks: string[];
  suggestedPlan: PlanId;
  cta: { label: string; href: string };
  // Don't-lose-your-work reassurance line.
  reassurance: string;
  usage?: { used: number; limit: number };
};

const REASSURANCE =
  "Your project, edits, and assets are saved. Upgrading picks up exactly where you left off — nothing is lost.";

export function upgradePaywall(
  reason: PaywallReason,
  opts: { used?: number; limit?: number; suggestedPlan?: PlanId } = {},
): PaywallResponse {
  const suggestedPlan = opts.suggestedPlan ?? "creator";
  const plan = PLANS[suggestedPlan];
  const usage =
    opts.used !== undefined && opts.limit !== undefined
      ? { used: opts.used, limit: opts.limit }
      : undefined;

  const unlocksByPlan: Record<PlanId, string[]> = {
    free: [],
    creator: [
      `${PLANS.creator.renderLimit} renders / month`,
      "1080p exports with no watermark",
      "1,000 AI messages / month",
      "Local render worker (unmetered cloud time)",
    ],
    studio: [
      "Unlimited renders & AI messages",
      "4K · priority render queue",
      "Brand kit (logo, colors, locked host persona)",
    ],
  };

  const copy: Record<PaywallReason, { title: string; message: string }> = {
    render_limit_reached: {
      title: "You've used every render on your plan",
      message:
        "You've hit your monthly render limit. Upgrade for more renders (or grab render credits) to export this video.",
    },
    render_minutes_exhausted: {
      title: "Out of render minutes this month",
      message:
        "You've used your monthly render-time allowance. Upgrade to keep exporting — paid plans get far more render minutes.",
    },
    cloud_render_exhausted: {
      title: "Free cloud render time used up",
      message:
        "Your free cloud render time is spent. Upgrade for unmetered cloud rendering, or install the free local worker to render on your own machine.",
    },
    chat_limit_reached: {
      title: "You've reached your AI message limit",
      message:
        "You've used every AI message on your plan this month. Upgrade to keep building and editing by chat.",
    },
  };

  return {
    paywall: true,
    reason,
    title: copy[reason].title,
    message: copy[reason].message,
    unlocks: unlocksByPlan[suggestedPlan] ?? unlocksByPlan.creator,
    suggestedPlan,
    cta: { label: `Upgrade to ${plan.name} · ${plan.priceLabel}/mo`, href: "/app/billing" },
    reassurance: REASSURANCE,
    usage,
  };
}
