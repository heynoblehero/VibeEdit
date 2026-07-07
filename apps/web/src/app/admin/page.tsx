"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import OverviewTab from "@/components/admin/OverviewTab";
import UsersTab from "@/components/admin/UsersTab";
import BillingTab from "@/components/admin/BillingTab";
import RendersTab from "@/components/admin/RendersTab";
import ModerationTab from "@/components/admin/ModerationTab";
import SupportInbox from "@/components/admin/SupportInbox";
import ObservabilityTiles from "@/components/admin/ObservabilityTiles";
import ProvidersPanel from "@/components/admin/ProvidersPanel";
import GrowthPanel from "@/components/admin/GrowthPanel";

type Tab =
  | "overview"
  | "analytics"
  | "users"
  | "billing"
  | "renders"
  | "moderation"
  | "support"
  | "monitoring"
  | "providers";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "users", label: "Users" },
  { id: "billing", label: "Billing" },
  { id: "renders", label: "Render ops" },
  { id: "moderation", label: "Moderation" },
  { id: "support", label: "Support" },
  { id: "monitoring", label: "Monitoring" },
  { id: "providers", label: "Providers" },
];

const TAB_IDS = new Set<string>(TABS.map((entry) => entry.id));

// Each tab id → its panel. Kept as a map so the shell stays a thin router and
// the actual UI lives in per-tab component files (see components/admin/*).
const PANELS: Record<Tab, ComponentType> = {
  overview: OverviewTab,
  analytics: GrowthPanel,
  users: UsersTab,
  billing: BillingTab,
  renders: RendersTab,
  moderation: ModerationTab,
  support: SupportInbox,
  monitoring: ObservabilityTiles,
  providers: ProvidersPanel,
};

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  // Deep-link support: /admin?tab=support lands directly on that tab. Read once
  // on mount from the URL (client-only, so no Suspense boundary needed). The
  // admin-notification emails link here with the relevant tab.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && TAB_IDS.has(requested)) setTab(requested as Tab);
  }, []);

  useEffect(() => {
    if (!session) return;
    // Probe the overview endpoint just to determine admin access.
    fetch("/api/admin/overview")
      .then((response) => {
        setStatus(response.status === 403 || response.status === 401 ? "forbidden" : "ok");
      })
      .catch(() => setStatus("forbidden"));
  }, [session]);

  function selectTab(next: Tab) {
    setTab(next);
    // Reflect the active tab in the URL without a navigation, so refresh/share
    // keeps the current tab.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  if (isPending || !session) return null;

  if (status === "forbidden") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-3 text-2xl font-bold">Not for you</h1>
        <p className="text-[var(--color-fg-muted)]">
          This page is for the operator only. Set{" "}
          <code className="rounded bg-[var(--color-bg-2)] px-1">ADMIN_EMAILS</code> in your env to
          your account email if this is your deployment.
        </p>
        <Link
          href="/app/projects"
          className="mt-4 inline-block text-[var(--color-accent)] underline"
        >
          Back to the app
        </Link>
      </main>
    );
  }

  const Panel = PANELS[tab];

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--color-accent)]">Admin</span>
      </header>

      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Operator console</h1>
      <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
        Single pane for users, billing, renders and moderation. Numbers are live from the DB.
      </p>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => selectTab(entry.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === entry.id
                ? "border-[var(--color-accent)] text-[var(--color-fg)]"
                : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <Panel />
    </main>
  );
}
