"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function icon(children: React.ReactNode): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
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
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>,
    ),
  },
  { href: "/app/renders", label: "Renders", icon: icon(<polygon points="5 3 19 12 5 21 5 3" />) },
  {
    href: "/app/effects",
    label: "Store",
    icon: icon(
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />,
    ),
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: icon(
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>,
    ),
  },
];

/**
 * Collapsed icon rail that expands to labels on hover — the logged-in app shell
 * nav. Fixed on the left; it overlays content when expanded so the layout never
 * shifts. Desktop only; small screens use the page's own top bar.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [settingsHover, setSettingsHover] = useState(false);
  const initials = initialsFor(session?.user?.name || session?.user?.email || "?");

  function openSettings() {
    window.dispatchEvent(new CustomEvent("vibeedit:open-settings"));
  }

  return (
    <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[3.75rem] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-2)] py-3 transition-[width] duration-200 hover:w-56 hover:shadow-2xl md:flex">
      {/* Logo */}
      <Link
        href="/app/projects"
        className="mx-2 mb-4 flex h-10 items-center gap-2.5 overflow-hidden rounded-xl px-2.5"
        title="VibeEdit"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-black">
          V
        </span>
        <span className="whitespace-nowrap text-sm font-bold text-[var(--color-fg)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          VibeEdit
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-10 items-center gap-3 overflow-hidden rounded-xl px-2.5 transition-colors ${
                active
                  ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={openSettings}
          onMouseEnter={() => setSettingsHover(true)}
          onMouseLeave={() => setSettingsHover(false)}
          title="Settings"
          className={`flex h-10 items-center gap-3 overflow-hidden rounded-xl px-2.5 text-left transition-colors ${
            settingsHover
              ? "bg-[var(--color-surface)] text-[var(--color-fg)]"
              : "text-[var(--color-fg-muted)]"
          }`}
        >
          <span className="shrink-0">
            {icon(
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8" />
              </>,
            )}
          </span>
          <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Settings
          </span>
        </button>
      </nav>

      {/* Account */}
      <div className="mt-2 border-t border-[var(--color-border)] px-2 pt-2">
        <button
          type="button"
          onClick={() => signOut().then(() => (window.location.href = "/"))}
          title="Sign out"
          className="flex h-10 w-full items-center gap-3 overflow-hidden rounded-xl px-2.5 text-left text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold uppercase text-black">
            {initials}
          </span>
          <span className="min-w-0 flex-1 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="block truncate text-xs font-medium text-[var(--color-fg)]">
              {session?.user?.name || session?.user?.email}
            </span>
            <span className="block text-[10px] text-[var(--color-fg-subtle)]">Sign out</span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function initialsFor(input: string): string {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}
