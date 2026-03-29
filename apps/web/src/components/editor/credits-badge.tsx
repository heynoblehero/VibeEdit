"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import Link from "next/link";

export function CreditsBadge() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0));

    const interval = setInterval(() => {
      fetch("/api/credits")
        .then((r) => r.json())
        .then((d) => setBalance(d.balance ?? 0))
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (balance === null) return null;

  const isLow = balance < 10;

  return (
    <Link
      href="/pricing"
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
        isLow
          ? "text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/15"
          : "text-muted-foreground bg-accent/50 hover:text-foreground hover:bg-accent"
      }`}
      title={`${balance} credits remaining — click to buy more`}
    >
      <Coins className="h-3 w-3" />
      <span className="tabular-nums">{balance}</span>
    </Link>
  );
}
