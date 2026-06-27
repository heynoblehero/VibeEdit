export default function EditorLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--color-bg)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      <span className="text-sm text-[var(--color-fg-muted)]">Opening editor…</span>
    </div>
  );
}
