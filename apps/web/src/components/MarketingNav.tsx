"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { useSession } from "@/lib/auth-client";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/showcase", label: "Showcase" },
  { href: "/#faq", label: "FAQ" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="VibeEdit home">
          <Wordmark size="md" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 text-sm md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              {link.label}
            </Link>
          ))}
          {session ? (
            <Link
              href="/app/projects"
              className="ml-3 rounded-lg bg-[var(--color-accent)] px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90"
            >
              Open app →
            </Link>
          ) : (
            <>
              <Link
                href="/app/login"
                className="rounded-md px-3 py-2 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                Sign in
              </Link>
              <Link
                href="/app/signup"
                className="ml-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90"
              >
                Start free
              </Link>
            </>
          )}
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {session ? (
            <Link
              href="/app/projects"
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black"
            >
              App →
            </Link>
          ) : (
            <Link
              href="/app/signup"
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black"
            >
              Start free
            </Link>
          )}
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <path
                d="M0 1h16M0 6h16M0 11h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="animate-slide-up ml-auto flex h-full w-full max-w-xs flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <div className="mb-8 flex items-center justify-between">
              <Wordmark size="sm" />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {[
                ...LINKS,
                { href: "/changelog", label: "Changelog" },
                { href: "/help", label: "Help" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
                >
                  {link.label}
                </Link>
              ))}
              {!session && (
                <Link
                  href="/app/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
                >
                  Sign in
                </Link>
              )}
            </div>
            <Link
              href={session ? "/app/projects" : "/app/signup"}
              onClick={() => setOpen(false)}
              className="mt-auto rounded-xl bg-[var(--color-accent)] px-4 py-3.5 text-center font-semibold text-black"
            >
              {session ? "Open app →" : "Start free — $1 trial on paid plans"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
