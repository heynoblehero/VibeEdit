"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type InviteInfo = {
  workspaceId: string;
  email: string;
  role: string;
};

export default function WorkspaceInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/workspaces/invite/${token}`)
      .then((r) => {
        if (r.ok) return r.json() as Promise<InviteInfo>;
        return r.text().then((t) => {
          throw new Error(t);
        });
      })
      .then(setInfo)
      .catch((error: Error) => setLoadError(error.message));
  }, [token]);

  async function accept() {
    if (!session) {
      // Redirect to login with return URL.
      router.replace(`/app/login?next=/workspace-invite/${token}`);
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    const r = await fetch(`/api/workspaces/invite/${token}`, { method: "POST" });
    setAccepting(false);
    if (r.ok) {
      const data = (await r.json()) as { workspaceId: string };
      router.replace(`/app/workspaces/${data.workspaceId}`);
    } else {
      const text = await r.text();
      setAcceptError(text || "Failed to accept invite.");
    }
  }

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Wordmark size="lg" />
          </Link>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl">
          {loadError ? (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 mx-auto">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="text-[var(--color-danger)]"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Invite not found</h1>
              <p className="text-sm text-[var(--color-fg-muted)]">{loadError}</p>
              <Link
                href="/app/projects"
                className="mt-6 inline-block rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Go to dashboard
              </Link>
            </>
          ) : !info ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 mx-auto">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--color-accent)]"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h1 className="mb-1 text-xl font-bold text-[var(--color-fg)]">You&apos;re invited</h1>
              <p className="mb-1 text-sm text-[var(--color-fg-muted)]">
                Join this workspace as{" "}
                <strong className="text-[var(--color-fg)]">{info.role}</strong>.
              </p>
              <p className="mb-6 text-xs text-[var(--color-fg-subtle)]">
                Invite sent to {info.email}
              </p>

              {acceptError && (
                <p className="mb-4 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 px-3 py-2 text-xs text-[var(--color-danger)]">
                  {acceptError}
                </p>
              )}

              {!session ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    Sign in to accept this invite.
                  </p>
                  <button
                    onClick={accept}
                    className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Sign in to accept
                  </button>
                </div>
              ) : (
                <button
                  onClick={accept}
                  disabled={accepting}
                  className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {accepting ? "Joining…" : "Accept invite"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
