"use client";

import { create } from "zustand";
import type { Project } from "@/lib/scene-schema";
import type { DraftProject } from "@/lib/agent/draft-schema";
import type { RunStage } from "@/lib/agent/runner";

/**
 * Client-side mirror of one server-side AgentRun.
 *
 * Lifecycle:
 *   `start(prompt)` POSTs /api/agent/runs, opens an EventSource on
 *   /api/agent/runs/:runId/events, and writes every event into store
 *   state. UI components subscribe selectively. Only one run is active
 *   at a time — starting another while one is live cancels the
 *   previous via /cancel.
 *
 * This store is intentionally not persisted: refreshing the page
 * abandons the run (the server's in-memory map keeps it alive but the
 * client loses its handle, which is fine for v1).
 */

export type SheetView = "idle" | "running" | "done" | "error";

interface AgentRunState {
	open: boolean;
	view: SheetView;
	runId: string | null;
	stage: RunStage | null;
	prompt: string;
	error: string | null;
	draft: DraftProject | null;
	finalProject: Project | null;
	openSheet: () => void;
	closeSheet: () => void;
	setPrompt: (p: string) => void;
	start: (prompt: string) => Promise<void>;
	cancel: () => Promise<void>;
	reset: () => void;
}

let activeEventSource: EventSource | null = null;

function teardownEventSource() {
	if (activeEventSource) {
		activeEventSource.close();
		activeEventSource = null;
	}
}

export const useAgentRunStore = create<AgentRunState>((set, get) => ({
	open: false,
	view: "idle",
	runId: null,
	stage: null,
	prompt: "",
	error: null,
	draft: null,
	finalProject: null,

	openSheet: () => set({ open: true }),
	closeSheet: () => set({ open: false }),
	setPrompt: (p) => set({ prompt: p }),

	reset: () => {
		teardownEventSource();
		set({
			view: "idle",
			runId: null,
			stage: null,
			error: null,
			draft: null,
			finalProject: null,
		});
	},

	start: async (prompt) => {
		teardownEventSource();
		set({
			view: "running",
			runId: null,
			stage: "queued",
			error: null,
			draft: null,
			finalProject: null,
			prompt,
		});

		let runId: string;
		try {
			const res = await fetch("/api/agent/runs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as
					| { error?: string }
					| null;
				throw new Error(body?.error ?? `agent start failed: HTTP ${res.status}`);
			}
			const data = (await res.json()) as { runId: string };
			runId = data.runId;
		} catch (err) {
			set({
				view: "error",
				error: err instanceof Error ? err.message : String(err),
				stage: "failed",
			});
			return;
		}

		set({ runId });

		const es = new EventSource(`/api/agent/runs/${runId}/events`);
		activeEventSource = es;
		es.onmessage = (e) => {
			try {
				const evt = JSON.parse(e.data) as {
					type?: string;
					stage?: RunStage;
					error?: string;
					draft?: DraftProject;
					finalProject?: Project;
				};
				if (evt.stage) set({ stage: evt.stage });
				if (evt.draft) set({ draft: evt.draft });
				if (evt.finalProject) set({ finalProject: evt.finalProject });
				if (evt.type === "done") {
					set({ view: "done", stage: "done" });
					teardownEventSource();
				} else if (evt.type === "failed") {
					set({
						view: "error",
						stage: "failed",
						error: evt.error ?? "agent failed",
					});
					teardownEventSource();
				}
			} catch {
				// malformed event — ignore
			}
		};
		es.onerror = () => {
			// EventSource auto-reconnects on transient errors; only
			// switch the view to "error" if we never received a draft
			// AND the run is over per the server's terminal events.
			// If we already have a finalProject this is just the
			// server hanging up after `done` — ignore.
			if (get().view === "running") {
				// Give the server a beat to send the last terminal event.
				setTimeout(() => {
					const cur = get();
					if (cur.view === "running") {
						set({
							view: "error",
							error: "lost connection to agent stream",
							stage: "failed",
						});
						teardownEventSource();
					}
				}, 500);
			}
		};
	},

	cancel: async () => {
		const { runId } = get();
		teardownEventSource();
		if (runId) {
			try {
				await fetch(`/api/agent/runs/${runId}/cancel`, { method: "POST" });
			} catch {
				// best-effort
			}
		}
		set({ view: "idle", stage: null, runId: null });
	},
}));
