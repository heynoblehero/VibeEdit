"use client";

import {
  BookOpen,
  Film,
  Gamepad2,
  Headphones,
  Images,
  ListOrdered,
  Lock,
  Mic2,
  Search,
  Sparkles,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { DIMENSIONS } from "@/lib/scene-schema";
import { WORKFLOWS } from "@/lib/workflows/registry";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

const ICONS: Record<string, LucideIcon> = {
  Film,
  Images,
  Mic2,
  BookOpen,
  Headphones,
  ListOrdered,
  Utensils,
  Search,
  Gamepad2,
  Sparkles,
};

interface WorkflowPickerProps {
  open: boolean;
  onClose: () => void;
  /** If true, the picker can't be dismissed without choosing. */
  force?: boolean;
}

export function WorkflowPicker({ open, onClose, force }: WorkflowPickerProps) {
  const project = useProjectStore((s) => s.project);
  const setWorkflowId = useProjectStore((s) => s.setWorkflowId);
  const setProject = useProjectStore((s) => s.setProject);
  const authenticated = useAuthStore((s) => s.authenticated);
  const unlockedWorkflows = useAuthStore((s) => s.unlockedWorkflows);
  const setUnlocked = useAuthStore((s) => s.setUnlocked);

  const isUnlocked = (wf: (typeof WORKFLOWS)[number]) => {
    if (!wf.paid) return true;
    // Unauthenticated users can preview paid workflows (picker lets you in,
    // the render gate stops them). Authenticated users see actual unlock state.
    if (!authenticated) return true;
    return unlockedWorkflows.includes(wf.id);
  };

  const tryUnlock = async (workflowId: string) => {
    // First try a real Stripe checkout. Fall back to the DEMO_UNLOCK path if
    // Stripe isn't configured on the server.
    try {
      const stripeRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });
      if (stripeRes.ok) {
        const stripeData = await stripeRes.json();
        if (stripeData.url) {
          // Send the browser to Stripe Checkout. The webhook will unlock the
          // workflow server-side; on return the `refresh()` call in AuthBar
          // picks up the new unlock state.
          window.location.href = stripeData.url;
          return false; // navigation happens asynchronously
        }
      }
    } catch {
      // fall through
    }

    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `unlock failed (${res.status})`);
      setUnlocked(data.unlockedWorkflows ?? []);
      toast.success("Workflow unlocked");
      return true;
    } catch (e) {
      toast.error("Unlock failed", {
        description: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  };

  useEffect(() => {
    if (!open || force) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, force, onClose]);

  if (!open) return null;

  const handlePick = async (
    workflowId: string,
    orientation: "landscape" | "portrait",
    templateId?: string,
  ) => {
    const wf = WORKFLOWS.find((w) => w.id === workflowId);
    if (!wf || !wf.enabled) {
      toast("That workflow is coming soon", { description: "Pick an enabled one for now." });
      return;
    }
    if (wf.paid && authenticated && !unlockedWorkflows.includes(wf.id)) {
      const proceed = window.confirm(
        `"${wf.name}" is a paid workflow. Unlock it for this account?\n\n(In production this would open Stripe checkout. For now it uses the DEMO_UNLOCK env flag on the server.)`,
      );
      if (!proceed) return;
      const ok = await tryUnlock(wf.id);
      if (!ok) return;
    }
    const dims = DIMENSIONS[orientation];
    const template = templateId ? wf.templates?.find((t) => t.id === templateId) : undefined;
    setProject({
      ...project,
      workflowId,
      workflowInputs: template?.values ?? {},
      width: dims.width,
      height: dims.height,
    });
    setWorkflowId(workflowId);
    onClose();
    toast.success(
      template ? `Started "${wf.name}" from template: ${template.name}` : `Switched to "${wf.name}"`,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-base font-semibold text-white">Pick a workflow</span>
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Each workflow has its own inputs and AI assistance. You can switch later.
            </div>
          </div>
          {!force && (
            <button
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {WORKFLOWS.map((wf) => {
            const Icon = ICONS[wf.icon] ?? Sparkles;
            const isActive = project.workflowId === wf.id;
            const disabled = !wf.enabled;
            return (
              <button
                key={wf.id}
                onClick={() => handlePick(wf.id, wf.defaultOrientation)}
                disabled={disabled}
                className={`flex flex-col items-start text-left gap-2 p-4 rounded-lg border transition-all ${
                  isActive
                    ? "border-emerald-500 bg-emerald-500/5"
                    : disabled
                      ? "border-neutral-900 bg-neutral-950 opacity-50 cursor-not-allowed"
                      : "border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800/80"
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${wf.accentColor}22`, color: wf.accentColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-white flex-1">{wf.name}</span>
                  {disabled && <Lock className="h-3 w-3 text-neutral-600" />}
                  {wf.paid && !isUnlocked(wf) && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                      paid
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      active
                    </span>
                  )}
                </div>
                <video
                  key={wf.id}
                  src={`/template-previews/${wf.id}.mp4`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full aspect-video object-cover rounded-md bg-black"
                  onError={(e) => {
                    (e.currentTarget as HTMLVideoElement).style.display = "none";
                  }}
                />
                <div className="text-[11px] text-neutral-400 leading-snug">{wf.tagline}</div>
                <div className="text-[10px] text-neutral-600">
                  {wf.defaultOrientation === "portrait" ? "9:16 vertical" : "16:9 landscape"}
                </div>
                {wf.templates && wf.templates.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-neutral-800/60 w-full">
                    {wf.templates.map((t) => (
                      <span
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePick(wf.id, wf.defaultOrientation, t.id);
                        }}
                        title={t.description}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-800 hover:border-emerald-500 hover:text-emerald-300 text-neutral-500 cursor-pointer transition-colors"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
