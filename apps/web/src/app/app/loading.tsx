export default function AppLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      <span className="text-sm text-[var(--color-fg-muted)]">Loading…</span>
    </div>
  );
}
