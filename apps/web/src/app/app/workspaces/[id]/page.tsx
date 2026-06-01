"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { UserMenu } from "@/components/UserMenu";

type Member = {
  id: string;
  userId: string | null;
  role: string;
  inviteEmail: string;
  inviteToken: string | null;
  joinedAt: string | number | null;
};

type WorkspaceDetail = {
  id: string;
  name: string;
  ownerId: string;
  isOwner: boolean;
  members: Member[];
  createdAt: string | number;
};

const ROLE_LABELS: Record<string, string> = {
  editor: "Editor",
  viewer: "Viewer",
  owner: "Owner",
};

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/workspaces/${id}`);
    if (r.status === 404 || r.status === 403) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (r.ok) setWs((await r.json()) as WorkspaceDetail);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (session) refresh();
  }, [session, id, refresh]);

  async function removeMember(memberId: string) {
    setRemoving(memberId);
    await fetch(`/api/workspaces/${id}/members/${memberId}`, { method: "DELETE" });
    setRemoving(null);
    refresh();
  }

  async function changeRole(memberId: string, role: string) {
    await fetch(`/api/workspaces/${id}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  }

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)]">
        <p className="text-[var(--color-fg-muted)]">Workspace not found.</p>
        <Link href="/app/workspaces" className="text-sm text-[var(--color-accent)] hover:underline">
          ← Back to workspaces
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/app/projects" className="shrink-0 transition-opacity hover:opacity-80">
              <Wordmark size="sm" />
            </Link>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="shrink-0 text-[var(--color-border)]"
              aria-hidden="true"
            >
              <path
                d="M4 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <Link
              href="/app/workspaces"
              className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Workspaces
            </Link>
            {ws && (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="shrink-0 text-[var(--color-border)]"
                  aria-hidden="true"
                >
                  <path
                    d="M4 2l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="max-w-[140px] truncate text-sm font-medium text-[var(--color-fg-muted)]">
                  {ws.name}
                </span>
              </>
            )}
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {loading || !ws ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-shimmer rounded-xl bg-[var(--color-surface)]" />
            ))}
          </div>
        ) : (
          <>
            {/* Workspace header */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 text-xl font-bold text-[var(--color-accent)]">
                  {ws.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-fg)]">{ws.name}</h1>
                  <p className="mt-0.5 text-sm text-[var(--color-fg-muted)]">
                    {ws.members.length} member{ws.members.length === 1 ? "" : "s"}
                    {ws.isOwner ? " · You own this workspace" : ""}
                  </p>
                </div>
              </div>
              {ws.isOwner && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setShowRename(true)}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-2)] hover:text-[var(--color-fg)]"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M5 1v8M1 5h8" />
                    </svg>
                    Invite
                  </button>
                </div>
              )}
            </div>

            {/* Members */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-4 py-3">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                  Members
                </span>
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {/* Owner row */}
                <li className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-xs font-bold text-[var(--color-accent)]">
                    {(session.user.name || session.user.email).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {ws.isOwner ? "You" : "Owner"}
                    </p>
                    <p className="truncate text-xs text-[var(--color-fg-subtle)]">
                      {session.user.email}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--color-accent)]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                    Owner
                  </span>
                </li>

                {/* Invited members */}
                {ws.members.map((member) => (
                  <li key={member.id} className="group flex items-center gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-xs font-medium text-[var(--color-fg-muted)]">
                      {member.inviteEmail.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {member.inviteEmail}
                      </p>
                      <p className="text-xs text-[var(--color-fg-subtle)]">
                        {member.joinedAt ? "Joined" : "Invite pending"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {ws.isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) => changeRole(member.id, e.target.value)}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="text-xs text-[var(--color-fg-muted)]">
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                      {ws.isOwner && (
                        <button
                          onClick={() => removeMember(member.id)}
                          disabled={removing === member.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-subtle)] opacity-0 transition-all hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-40 group-hover:opacity-100"
                          title="Remove member"
                        >
                          {removing === member.id ? (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-danger)]" />
                          ) : (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              aria-hidden="true"
                            >
                              <path d="M1 1l10 10M11 1L1 11" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                ))}

                {ws.members.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-[var(--color-fg-subtle)]">
                    No members yet.{ws.isOwner ? " Invite someone to collaborate." : ""}
                  </li>
                )}
              </ul>
            </div>

            {/* Projects link */}
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-xs text-[var(--color-fg-muted)]">
                To add projects to this workspace, open a project and update its workspace in
                Settings → Project. Workspace members can see and edit all projects in this
                workspace.
              </p>
            </div>
          </>
        )}
      </div>

      {showInvite && ws && (
        <InviteModal
          workspaceId={id}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            refresh();
          }}
        />
      )}

      {showRename && ws && (
        <RenameModal
          workspaceId={id}
          currentName={ws.name}
          onClose={() => setShowRename(false)}
          onRenamed={() => {
            setShowRename(false);
            refresh();
          }}
        />
      )}
    </main>
  );
}

function InviteModal({
  workspaceId,
  onClose,
  onInvited,
}: {
  workspaceId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    const r = await fetch(`/api/workspaces/${workspaceId}/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setSaving(false);
    if (r.ok) onInvited();
    else setError(await r.text());
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-fg)]">Invite member</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <form onSubmit={invite} className="p-5 space-y-4">
          {error && (
            <p className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 px-3 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Email address
            </span>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="teammate@example.com"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Role
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["editor", "viewer"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border py-2.5 text-xs font-medium capitalize transition-colors ${
                    role === r
                      ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-fg)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-2)]"
                  }`}
                >
                  {r === "editor" ? "Editor — can edit" : "Viewer — read only"}
                </button>
              ))}
            </div>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-border-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !email.trim()}
              className="flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RenameModal({
  workspaceId,
  currentName,
  onClose,
  onRenamed,
}: {
  workspaceId: string;
  currentName: string;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) return;
    setSaving(true);
    await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    onRenamed();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-fg)]">Rename workspace</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <form onSubmit={rename} className="p-5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-fg-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
