"use client";

import { Card, Empty, Loading, useAdminData } from "./ui";

type ModSnippet = {
  id: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  likesCount: number;
  userEmail: string | null;
  createdAt: string;
};
type ModShowcase = {
  id: string;
  showcased: boolean;
  publicShareSlug: string | null;
  userEmail: string | null;
  createdAt: string;
};

type ModerationData = { snippets: ModSnippet[]; showcased: ModShowcase[] };

export default function ModerationTab() {
  const { data, reload } = useAdminData<ModerationData>("/api/admin/moderation");

  async function toggle(type: "snippet" | "showcase", id: string, visible: boolean) {
    await fetch("/api/admin/moderation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, id, visible }),
    }).catch(() => {});
    reload();
  }

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <Card title={`Public marketplace snippets (${data.snippets.length})`}>
        {data.snippets.length === 0 ? (
          <Empty>Nothing public.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.snippets.map((snippet) => (
              <li
                key={snippet.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{snippet.label}</div>
                  <div className="truncate text-xs text-[var(--color-fg-muted)]">
                    {snippet.userEmail || "—"} · {snippet.likesCount} likes
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle("snippet", snippet.id, false)}
                  className="shrink-0 rounded-lg border border-[var(--color-danger)] px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  Unpublish
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Showcased renders (${data.showcased.length})`}>
        {data.showcased.length === 0 ? (
          <Empty>Nothing showcased.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.showcased.map((showcase) => (
              <li
                key={showcase.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">{showcase.publicShareSlug || showcase.id}</div>
                  <div className="truncate text-xs text-[var(--color-fg-muted)]">
                    {showcase.userEmail || "—"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle("showcase", showcase.id, false)}
                  className="shrink-0 rounded-lg border border-[var(--color-danger)] px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  Hide
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
