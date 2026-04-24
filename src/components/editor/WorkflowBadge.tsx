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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Change workflow"
        className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors"
        style={{
          backgroundColor: `${wf.accentColor}18`,
          color: wf.accentColor,
          borderColor: `${wf.accentColor}40`,
        }}
      >
        <Sparkles className={`h-3 w-3 ${agentStreaming ? "animate-pulse" : ""}`} />
        {wf.name}
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
