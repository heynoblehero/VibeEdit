"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth/client";
import { ArrowLeft, Key, Check, Sparkles } from "lucide-react";

interface ServiceConfig {
  id: string;
  name: string;
  configured: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    fetch("/api/ai/keys")
      .then(r => r.json())
      .then(d => setServices(d.services || []))
      .catch(() => {});
  }, []);

  const saveKey = async (serviceId: string) => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceId, apiKey: keyInput.trim() }),
      });
      if (resp.ok) {
        setServices(prev => prev.map(s => s.id === serviceId ? { ...s, configured: true } : s));
        setEditing(null);
        setKeyInput("");
      }
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (serviceId: string) => {
    await fetch(`/api/ai/keys?service=${serviceId}`, { method: "DELETE" });
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, configured: false } : s));
  };

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-hero-bg">
      <div className="mx-auto max-w-lg px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-[family-name:var(--font-display)] tracking-tight">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage API keys and preferences</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </div>

        {/* API Keys Card */}
        <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border/30 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold font-[family-name:var(--font-display)]">API Keys</h2>
              <p className="text-[11px] text-muted-foreground">Stored securely on the server, never sent to the browser.</p>
            </div>
          </div>

          {services.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No services available.
            </div>
          )}

          {services.map(service => (
            <div key={service.id} className="px-6 py-4 border-b border-border/20 last:border-0 hover:bg-accent/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    {service.configured ? (
                      <>
                        <Check className="h-3 w-3 text-constructive" />
                        <span className="text-constructive">Configured</span>
                      </>
                    ) : (
                      "Not configured"
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {service.configured && (
                    <button
                      onClick={() => removeKey(service.id)}
                      className="rounded-full px-3 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(service.id); setKeyInput(""); }}
                    className="rounded-full px-3 py-1 text-xs text-primary hover:bg-primary/10 transition-colors font-medium"
                  >
                    {service.configured ? "Update" : "Add key"}
                  </button>
                </div>
              </div>

              {editing === service.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder={`Paste your ${service.name} API key`}
                    className="flex-1 rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && saveKey(service.id)}
                  />
                  <button
                    onClick={() => saveKey(service.id)}
                    disabled={saving || !keyInput.trim()}
                    className="rounded-xl gradient-primary text-white px-4 py-2 text-sm font-medium hover:shadow-[0_0_15px_hsl(262_83%_58%/0.3)] disabled:opacity-50 transition-all"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setKeyInput(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          VibeEdit — AI-Powered Video Editor
        </p>
      </div>
    </div>
  );
}
