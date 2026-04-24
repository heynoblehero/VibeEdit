"use client";

import { AlertCircle, Check, Loader2, Stethoscope, Wrench, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getOrientation, type Scene } from "@/lib/scene-schema";
import { getWorkflow } from "@/lib/workflows/registry";
import { useProjectStore } from "@/store/project-store";

interface Finding {
  sceneId: string;
  severity: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
  patch?: Partial<Scene>;
  applied?: boolean;
  dismissed?: boolean;
}

const SEV_CLASS: Record<Finding["severity"], string> = {
  high: "text-red-400 border-red-500/30 bg-red-500/5",
  medium: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  low: "text-neutral-400 border-neutral-500/30 bg-neutral-500/5",
};

export function ReviewPanel() {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateScene = useProjectStore((s) => s.updateScene);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);

  const runReview = async () => {
    if (project.scenes.length === 0) return;
    setLoading(true);
    setFindings([]);
    setOpen(true);
    const toastId = toast.loading("Reviewing project...");
    const collected: Finding[] = [];
    try {
      const workflow = getWorkflow(project.workflowId);
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: project.scenes,
          orientation: getOrientation(project),
          workflowId: workflow.id,
          workflowCriteria: workflow.reviewCriteria,
        }),
      });
      if (!res.ok || !res.body) {
        let msg = `review failed (${res.status})`;
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = dataLine.slice("data: ".length);
          let evt: { type: string; finding?: Finding; count?: number; error?: string };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "finding" && evt.finding) {
            collected.push(evt.finding);
            setFindings([...collected]);
            toast.loading(`Reviewing... (${collected.length})`, { id: toastId });
          } else if (evt.type === "done") {
            toast.success(
              collected.length === 0
                ? "No issues found — video looks good"
                : `${collected.length} findings`,
              { id: toastId },
            );
          } else if (evt.type === "error" && evt.error) {
            throw new Error(evt.error);
          }
        }
      }
    } catch (e) {
      toast.error("Review failed", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFinding = (idx: number) => {
    const f = findings[idx];
    if (!f?.patch || Object.keys(f.patch).length === 0) return;
    updateScene(f.sceneId, f.patch);
    setFindings((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, applied: true } : x)),
    );
  };

  const applyAll = () => {
    let count = 0;
    for (const f of findings) {
      if (f.applied || f.dismissed) continue;
      if (!f.patch || Object.keys(f.patch).length === 0) continue;
      updateScene(f.sceneId, f.patch);
      count++;
    }
    setFindings((prev) =>
      prev.map((f) =>
        f.applied || f.dismissed || !f.patch || Object.keys(f.patch).length === 0
          ? f
          : { ...f, applied: true },
      ),
    );
    toast.success(`Applied ${count} fixes`);
  };

  const dismissFinding = (idx: number) => {
    setFindings((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, dismissed: true } : x)),
    );
  };

  const visible = findings.filter((f) => !f.dismissed);
  const applicable = visible.filter(
    (f) => !f.applied && f.patch && Object.keys(f.patch).length > 0,
  );

  return (
    <>
      <button
        onClick={runReview}
        disabled={loading || project.scenes.length === 0}
        title="Review the whole project and suggest fixes"
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 disabled:opacity-40 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Stethoscope className="h-3 w-3" />
        )}
        Review
      </button>
      {open && (findings.length > 0 || loading) && (
        <div className="fixed top-16 right-4 w-96 max-h-[70vh] bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-40 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Review</span>
              <span className="text-[10px] text-neutral-500">
                {visible.length} findings
              </span>
            </div>
            <div className="flex items-center gap-1">
              {applicable.length > 0 && (
                <button
                  onClick={applyAll}
                  className="flex items-center gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded transition-colors"
                >
                  <Wrench className="h-3 w-3" />
                  Apply all ({applicable.length})
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visible.map((f, idx) => {
              const scene = project.scenes.find((s) => s.id === f.sceneId);
              const sceneIdx = project.scenes.findIndex((s) => s.id === f.sceneId);
              const hasPatch = f.patch && Object.keys(f.patch).length > 0;
              return (
                <div
                  key={`${f.sceneId}-${idx}`}
                  className={`flex flex-col gap-1 p-2.5 border-b border-neutral-900 last:border-b-0 border-l-2 ${SEV_CLASS[f.severity]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => selectScene(f.sceneId)}
                      className="text-[10px] font-mono text-neutral-500 hover:text-white shrink-0"
                    >
                      {scene ? `Scene ${sceneIdx + 1}` : "Scene ?"}
                    </button>
                    <AlertCircle className={`h-3 w-3 shrink-0 ${SEV_CLASS[f.severity].split(" ")[0]}`} />
                  </div>
                  <div className="text-xs text-white">{f.issue}</div>
                  <div className="text-[11px] text-neutral-400">→ {f.suggestion}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {hasPatch && !f.applied && (
                      <button
                        onClick={() => applyFinding(findings.indexOf(f))}
                        className="flex items-center gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded transition-colors"
                      >
                        <Wrench className="h-2.5 w-2.5" />
                        Apply fix
                      </button>
                    )}
                    {f.applied && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <Check className="h-2.5 w-2.5" />
                        Applied
                      </span>
                    )}
                    <button
                      onClick={() => dismissFinding(findings.indexOf(f))}
                      className="text-[10px] text-neutral-500 hover:text-white ml-auto"
                    >
                      dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
