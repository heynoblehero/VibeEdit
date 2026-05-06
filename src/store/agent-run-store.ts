"use client";

import { create } from "zustand";
import type { Project } from "@/lib/scene-schema";
import type { DraftProject } from "@/lib/agent/draft-schema";
import type { RunStage } from "@/lib/agent/runner";
import type { ClarifyQuestion, UploadRequest } from "@/lib/agent/tools";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Client-side mirror of one server AgentRun.
 *
 * The Phase A lifecycle (start → SSE → done) extends to handle:
 *   clarify_request — server is paused awaiting answers; the sheet
 *     shows a question card; submit goes via POST /respond.
 *   upload_request  — server is paused awaiting a file; the sheet
 *     shows an upload card; submit goes via POST /upload.
 *
 * One run at a time. Starting another while one is live cancels the
 * previous via /cancel.
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
	pendingClarify: ClarifyQuestion[] | null;
	pendingUpload: UploadRequest | null;
	openSheet: () => void;
	closeSheet: () => void;
	setPrompt: (p: string) => void;
	start: (prompt: string) => Promise<void>;
	cancel: () => Promise<void>;
	reset: () => void;
	submitClarify: (answers: Record<string, string>) => Promise<void>;
	submitUpload: (file: File) => Promise<void>;
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
	pendingClarify: null,
	pendingUpload: null,

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
			pendingClarify: null,
			pendingUpload: null,
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
			pendingClarify: null,
			pendingUpload: null,
			prompt,
		});

		const project = useProjectStore.getState().project;
		const assetStoreState = useAssetStore.getState();

		let runId: string;
		try {
			const res = await fetch("/api/agent/runs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt,
					project,
					characters: assetStoreState.characters,
					sfx: assetStoreState.sfx,
				}),
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
					questions?: ClarifyQuestion[];
					request?: UploadRequest;
					pending?: {
						kind: "clarify" | "upload";
						questions?: ClarifyQuestion[];
						request?: UploadRequest;
					} | null;
				};
				if (evt.stage) set({ stage: evt.stage });
				if (evt.draft) set({ draft: evt.draft });
				if (evt.finalProject) set({ finalProject: evt.finalProject });

				if (evt.type === "snapshot" && evt.pending) {
					if (evt.pending.kind === "clarify" && evt.pending.questions) {
						set({
							pendingClarify: evt.pending.questions,
							pendingUpload: null,
						});
					} else if (evt.pending.kind === "upload" && evt.pending.request) {
						set({
							pendingUpload: evt.pending.request,
							pendingClarify: null,
						});
					}
				} else if (evt.type === "clarify_request" && evt.questions) {
					set({ pendingClarify: evt.questions, pendingUpload: null });
				} else if (evt.type === "upload_request" && evt.request) {
					set({ pendingUpload: evt.request, pendingClarify: null });
				} else if (evt.type === "stage" && evt.stage === "thinking") {
					// Once we're back to thinking, clear any stale prompts.
					set({ pendingClarify: null, pendingUpload: null });
				}

				if (evt.type === "done") {
					set({
						view: "done",
						stage: "done",
						pendingClarify: null,
						pendingUpload: null,
					});
					teardownEventSource();
				} else if (evt.type === "failed") {
					set({
						view: "error",
						stage: "failed",
						error: evt.error ?? "agent failed",
						pendingClarify: null,
						pendingUpload: null,
					});
					teardownEventSource();
				}
			} catch {
				// malformed event — ignore
			}
		};
		es.onerror = () => {
			if (get().view === "running") {
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

	submitClarify: async (answers) => {
		const { runId } = get();
		if (!runId) return;
		set({ pendingClarify: null });
		try {
			const res = await fetch(`/api/agent/runs/${runId}/respond`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ kind: "clarify", answers }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as
					| { error?: string }
					| null;
				throw new Error(body?.error ?? `submit failed: HTTP ${res.status}`);
			}
		} catch (err) {
			set({
				view: "error",
				error: err instanceof Error ? err.message : String(err),
			});
		}
	},

	submitUpload: async (file) => {
		const { runId } = get();
		if (!runId) return;
		set({ pendingUpload: null });
		try {
			const form = new FormData();
			form.append("file", file);
			const res = await fetch(`/api/agent/runs/${runId}/upload`, {
				method: "POST",
				body: form,
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as
					| { error?: string }
					| null;
				throw new Error(body?.error ?? `upload failed: HTTP ${res.status}`);
			}
		} catch (err) {
			set({
				view: "error",
				error: err instanceof Error ? err.message : String(err),
			});
		}
	},
}));
