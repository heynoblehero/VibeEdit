"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import { getWorkflow } from "@/lib/workflows/registry";
import { useChatStore } from "@/store/chat-store";
import { useProjectStore } from "@/store/project-store";
import { WorkflowPicker } from "./WorkflowPicker";

export function WorkflowBadge() {
  const workflowId = useProjectStore((s) => s.project.workflowId);
  const agentStreaming = useChatStore((s) => s.isStreaming);
  const [open, setOpen] = useState(false);
  const wf = getWorkflow(workflowId);

  // Blank is the default / no-template state — don't show a badge for it so
  // the header stays quiet. Click the workflow picker from elsewhere if you
  // want to opt into a template.
  const isBlank = wf.id === "blank";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Video type: ${wf.name} — click to change`}
        className={`flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded transition-colors ${isBlank ? "hidden sm:flex opacity-60" : ""}`}
      >
        <Sparkles
          className={`h-3 w-3 ${agentStreaming ? "animate-pulse" : ""}`}
          style={{ color: wf.accentColor }}
        />
        <span>{wf.name}</span>
        {wf.paid && (
          <span className="text-[8px] font-bold px-1 rounded bg-amber-500/30 text-amber-200 border border-amber-500/40">
            PRO
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <WorkflowPicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}
