export function Wordmark({
  size = "md",
  compactBadge = false,
}: {
  size?: "sm" | "md" | "lg";
  // When true, the "VIDEO" badge is hidden on small screens to declutter
  // cramped mobile headers (e.g. the editor top bar).
  compactBadge?: boolean;
}) {
  const className = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className={`font-black tracking-tight ${className} flex items-baseline gap-1`}>
      <span className="text-[var(--color-fg)]">vibe</span>
      <span className="text-[var(--color-accent)]">edit</span>
      <span
        className={`ml-1 rounded bg-[var(--color-accent)] px-1.5 py-0 text-[0.6em] font-black uppercase tracking-widest text-black ${compactBadge ? "hidden sm:inline-block" : ""}`}
      >
        video
      </span>
    </div>
  );
}
