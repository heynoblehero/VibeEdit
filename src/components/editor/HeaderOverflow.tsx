"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function HeaderOverflow({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Export · Review · Schedule · Account"
        className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50 min-w-[180px]"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
