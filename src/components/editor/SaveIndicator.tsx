"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { onStorageFlush } from "@/store/throttled-storage";

// Flashes "Saved" for 1.2s after each throttled localStorage write completes.
export function SaveIndicator() {
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return onStorageFlush(() => {
      setFlashing(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setFlashing(false), 1200);
    });
  }, []);

  if (!flashing) return null;
  return (
    <span
      title="Project state saved to browser"
      className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono"
    >
      <Check className="h-3 w-3" />
      saved
    </span>
  );
}
