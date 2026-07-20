"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { getMe } from "@/lib/billing/me-client";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function svg(children: React.ReactNode): React.ReactNode {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: "/app/projects",
    label: "Projects",
    icon: svg(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>,
    ),
  },
  { href: "/app/renders", label: "Renders", icon: svg(<polygon points="5 3 19 12 5 21 5 3" />) },
  {
    href: "/app/effects",
    label: "Store",
    icon: svg(
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />,
    ),
  },
  {
    href: "/app/storage",
    label: "Storage",
    icon: svg(
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </>,
    ),
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: svg(
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>,
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8" />
      </>,
    ),
  },
];

/** A row where the icon is centered in a fixed 60px slot (so it stays aligned
 *  whether the rail is collapsed or expanded) and the label follows. */
function Row({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={`flex h-11 items-center rounded-xl transition-colors ${
        active
          ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
          : "text-[var(--color-fg-muted)] group-hover/row:bg-[var(--color-surface)] group-hover/row:text-[var(--color-fg)]"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Collapsed icon rail that expands to labels on hover — the logged-in app-shell
 * nav. Occupies a fixed 60px column (content is padded to match); expanding on
 * hover overlays without shifting the page.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = initialsFor(session?.user?.name || session?.user?.email || "?");

  return (
    <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[60px] flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-2)] py-3 transition-[width] duration-200 hover:w-56 hover:shadow-2xl md:flex">
      {/* Logo */}
      <Link href="/app/projects" className="group/row mb-3 block px-2.5" title="VibeEdit">
        <span className="flex h-9 items-center rounded-xl">
          <span className="flex w-[35px] shrink-0 items-center justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-black">
              V
            </span>
          </span>
          <span className="ml-1 whitespace-nowrap text-sm font-bold text-[var(--color-fg)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            VibeEdit
          </span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-2 px-2.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className="group/row block" title={item.label}>
              <Row active={active}>
                <span className="flex w-[35px] shrink-0 items-center justify-center">
                  {item.icon}
                </span>
                <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                </span>
              </Row>
            </Link>
          );
        })}
      </nav>

      {/* Usage: credits + storage. Both fetch client-side and fail silently so a
          billing/storage hiccup never breaks the app shell. */}
      <UsageMeters />

      {/* Account */}
      <div className="mt-2 border-t border-[var(--color-border)] px-2.5 pt-2">
        <button
          type="button"
          onClick={() => signOut().then(() => (window.location.href = "/"))}
          className="group/row block w-full"
          title="Sign out"
        >
          <Row>
            <span className="flex w-[35px] shrink-0 items-center justify-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold uppercase text-black">
                {initials}
              </span>
            </span>
            <span className="min-w-0 flex-1 whitespace-nowrap text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="block truncate text-xs font-medium text-[var(--color-fg)]">
                {session?.user?.name || session?.user?.email}
              </span>
              <span className="block text-[10px] text-[var(--color-fg-subtle)]">Sign out</span>
            </span>
          </Row>
        </button>
      </div>
    </aside>
  );
}

type StorageUsage = { usedBytes: number; limitBytes: number; fraction: number };

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/** Credits + storage readouts that sit above the account block. Compact icon in
 *  the collapsed rail; the number/bar fade in when the rail expands on hover. */
function UsageMeters() {
  const [credits, setCredits] = useState<number | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => {
        if (me?.credits) setCredits(me.credits.total);
      })
      .catch(() => {});
    fetch("/api/storage")
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => value && setStorage(value as StorageUsage))
      .catch(() => {});
  }, []);

  const unlimited = !storage || storage.limitBytes < 0;
  const pct = storage && storage.limitBytes > 0 ? Math.round(storage.fraction * 100) : 0;
  const near = pct >= 80;
  const creditsLabel = credits === null ? "—" : credits < 0 ? "∞" : String(credits);

  return (
    <div className="mt-2 space-y-1 border-t border-[var(--color-border)] px-2.5 pt-2">
      {/* Credits → billing */}
      <Link href="/app/billing" className="group/row block" title={`${creditsLabel} credits`}>
        <Row>
          <span className="flex w-[35px] shrink-0 items-center justify-center">
            {svg(
              <>
                <circle cx="12" cy="12" r="8" />
                <path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v11" />
              </>,
            )}
          </span>
          <span className="min-w-0 flex-1 whitespace-nowrap text-left text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="text-[var(--color-fg)]">{creditsLabel}</span>{" "}
            <span className="text-[var(--color-fg-subtle)]">credits</span>
          </span>
        </Row>
      </Link>

      {/* Storage → storage page */}
      <Link
        href="/app/storage"
        className="group/row block"
        title={
          storage
            ? `Storage ${formatSize(storage.usedBytes)}${unlimited ? "" : ` of ${formatSize(storage.limitBytes)}`}`
            : "Storage"
        }
      >
        <Row>
          <span className="flex w-[35px] shrink-0 items-center justify-center">
            {svg(
              <>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                <path d="M3 12a9 3 0 0 0 18 0" />
              </>,
            )}
          </span>
          <span className="min-w-0 flex-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-[var(--color-fg)]">Storage</span>
              {storage && (
                <span
                  className={near ? "text-[var(--color-danger)]" : "text-[var(--color-fg-subtle)]"}
                >
                  {unlimited ? formatSize(storage.usedBytes) : `${pct}%`}
                </span>
              )}
            </span>
            {storage && !unlimited && (
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: near ? "var(--color-danger)" : "var(--color-accent)",
                  }}
                />
              </span>
            )}
          </span>
        </Row>
      </Link>
    </div>
  );
}

function initialsFor(input: string): string {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}
