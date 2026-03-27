"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth/client";

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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage API keys and preferences</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">API Keys</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Keys are stored securely on the server and never sent to the browser.</p>
          </div>

          {services.map(service => (
            <div key={service.id} className="px-5 py-4 border-b border-border last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{service.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {service.configured ? "\u2713 Configured" : "Not configured"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {service.configured && (
                    <button
                      onClick={() => removeKey(service.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(service.id); setKeyInput(""); }}
                    className="text-xs text-primary hover:underline"
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
                    className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && saveKey(service.id)}
                  />
                  <button
                    onClick={() => saveKey(service.id)}
                    disabled={saving || !keyInput.trim()}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setKeyInput(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          VibeEdit — AI-Powered Video Editor
        </p>
      </div>
    </div>
  );
}
