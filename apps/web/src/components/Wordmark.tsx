export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const className = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className={`font-black tracking-tight ${className} flex items-baseline gap-1`}>
      <span className="text-[var(--color-fg)]">vibe</span>
      <span className="text-[var(--color-accent)]">edit</span>
      <span className="ml-1 rounded bg-[var(--color-accent)] px-1.5 py-0 text-[0.6em] font-black uppercase tracking-widest text-black">
        video
      </span>
    </div>
  );
}
