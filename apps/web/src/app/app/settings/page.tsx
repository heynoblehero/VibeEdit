"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  if (isPending || !session) return null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-fg)] sm:text-3xl">Settings</h1>
      <SettingsPanel />
    </main>
  );
}
