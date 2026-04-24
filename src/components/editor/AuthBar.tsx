"use client";

import { LogIn, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";

export function AuthBar() {
  const { authenticated, email, refresh, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${mode} failed (${res.status})`);
      await refresh();
      setOpen(false);
      setPassword("");
      toast.success(mode === "signup" ? "Account created" : "Signed in");
    } catch (e) {
      toast.error(`${mode} failed`, {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authenticated) {
    return (
      <div className="flex items-center gap-1 text-[11px] text-neutral-400">
        <User className="h-3 w-3" />
        <span className="max-w-[120px] truncate">{email}</span>
        <button
          onClick={() => signOut()}
          title="Sign out"
          className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
      >
        <LogIn className="h-3 w-3" />
        Sign in
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {mode === "signup" ? "Create account" : "Sign in"}
              </span>
              <button
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="ml-auto text-[11px] text-neutral-500 hover:text-white"
              >
                {mode === "signup" ? "have an account? sign in" : "new? create account"}
              </button>
            </div>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="password (8+ chars)"
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(false)}
                className="text-[11px] text-neutral-500 hover:text-white px-2"
              >
                cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="ml-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
              >
                {mode === "signup" ? "Create" : "Sign in"}
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 leading-tight">
              Auth is scaffolded with a local JSON user store so you can test paywalls end-to-end. Swap for Clerk before shipping.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
