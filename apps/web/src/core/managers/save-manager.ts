import type { EditorCore } from "@/core";
import { storageService } from "@/services/storage/service";

type SaveManagerOptions = {
	debounceMs?: number;
	versionIntervalMs?: number;
};

export class SaveManager {
	private debounceMs: number;
	private versionIntervalMs: number;
	private isPaused = false;
	private isSaving = false;
	private hasPendingSave = false;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribeHandlers: Array<() => void> = [];
	private lastVersionTime = 0;
	private saveCount = 0;

	constructor(
		private editor: EditorCore,
		{ debounceMs = 800, versionIntervalMs = 60_000 }: SaveManagerOptions = {},
	) {
		this.debounceMs = debounceMs;
		this.versionIntervalMs = versionIntervalMs;
	}

	start(): void {
		if (this.unsubscribeHandlers.length > 0) return;

		this.unsubscribeHandlers = [
			this.editor.scenes.subscribe(() => {
				this.markDirty();
			}),
			this.editor.timeline.subscribe(() => {
				this.markDirty();
			}),
		];
	}

	stop(): void {
		for (const unsubscribe of this.unsubscribeHandlers) {
			unsubscribe();
		}
		this.unsubscribeHandlers = [];
		this.clearTimer();
	}

	pause(): void {
		this.isPaused = true;
	}

	resume(): void {
		this.isPaused = false;
		if (this.hasPendingSave) {
			this.queueSave();
		}
	}

	markDirty({ force = false }: { force?: boolean } = {}): void {
		if (this.isPaused && !force) return;
		this.hasPendingSave = true;
		this.queueSave();
	}

	async flush(): Promise<void> {
		this.hasPendingSave = true;
		await this.saveNow();
	}

	getIsDirty(): boolean {
		return this.hasPendingSave || this.isSaving;
	}

	private queueSave(): void {
		if (this.isSaving) return;
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}
		this.saveTimer = setTimeout(() => {
			void this.saveNow();
		}, this.debounceMs);
	}

	private async saveNow(): Promise<void> {
		if (this.isSaving) return;
		if (!this.hasPendingSave) return;

		const activeProject = this.editor.project.getActive();
		if (!activeProject) return;
		if (this.editor.project.getIsLoading()) return;
		if (this.editor.project.getMigrationState().isMigrating) return;

		this.isSaving = true;
		this.hasPendingSave = false;
		this.clearTimer();

		try {
			await this.editor.project.saveCurrentProject();
			this.saveCount++;

			// Create version snapshot periodically (throttled)
			const now = Date.now();
			if (now - this.lastVersionTime >= this.versionIntervalMs) {
				this.lastVersionTime = now;
				this.createVersionSnapshot().catch(() => {});
			}
		} finally {
			this.isSaving = false;
			if (this.hasPendingSave) {
				this.queueSave();
			}
		}
	}

	private async createVersionSnapshot(): Promise<void> {
		const activeProject = this.editor.project.getActive();
		if (!activeProject) return;

		const projectId = activeProject.metadata.id;
		const serialized = this.editor.project.serializeProject() as any;
		if (!serialized) return;

		const label = `Auto-save #${this.saveCount}`;
		await storageService.saveVersionSnapshot({
			projectId,
			label,
			project: serialized,
		});
	}

	private clearTimer(): void {
		if (!this.saveTimer) return;
		clearTimeout(this.saveTimer);
		this.saveTimer = null;
	}
}
