import type { Project, Scene } from "@/lib/scene-schema";

/**
 * Compact, agent-readable summary of the project's current state.
 *
 * Sent in the first user message of every chat turn so the agent always
 * knows what's there. Avoids serializing the full Project JSON (motion
 * clips, keyframes, full styles) which would balloon the token budget
 * and confuse the model with fields it shouldn't touch in v1.
 *
 * Scenes show: id, type, duration, key text fields, transition,
 * has_voiceover flag, background color/grade. Per-scene zoom-in is
 * available via the read_scene tool when the agent needs full detail.
 */
export function renderProjectSummary(project: Project): string {
	const orientation =
		project.height > project.width ? "portrait (9:16)" : "landscape (16:9)";
	const dur = project.scenes
		.reduce((sum, s) => sum + s.duration, 0)
		.toFixed(1);
	const lines: string[] = [
		`# Current project state`,
		`- Name: "${project.name}"`,
		`- Orientation: ${orientation} (${project.width}×${project.height})`,
		`- Total duration: ${dur}s across ${project.scenes.length} scene${project.scenes.length === 1 ? "" : "s"}`,
		`- FPS: ${project.fps}`,
	];
	if (project.music) {
		lines.push(`- Music: ${project.music.name ?? project.music.url}`);
	}
	if (project.captionStyle) {
		lines.push(`- Captions: enabled (${project.captionStyle.position ?? "auto"})`);
	}
	if (project.uploads && project.uploads.length > 0) {
		lines.push(`- Uploads available: ${project.uploads.length}`);
		for (const u of project.uploads.slice(0, 12)) {
			lines.push(`    · ${u.name}${u.type ? ` (${u.type})` : ""} → ${u.url}`);
		}
		if (project.uploads.length > 12) {
			lines.push(`    · (+${project.uploads.length - 12} more, omitted)`);
		}
	}
	if (project.scenes.length === 0) {
		lines.push("");
		lines.push("**No scenes yet.** Call `add_scene` to create one.");
		return lines.join("\n");
	}
	lines.push("");
	lines.push(`## Scenes`);
	project.scenes.forEach((s, i) => {
		lines.push(formatSceneLine(i, s));
	});
	return lines.join("\n");
}

function formatSceneLine(index: number, s: Scene): string {
	const parts: string[] = [];
	parts.push(`${index + 1}. [${s.id}] ${s.type} · ${s.duration.toFixed(1)}s`);
	if (s.background?.color) parts.push(`bg=${s.background.color}`);
	if (s.background?.colorGrade && s.background.colorGrade !== "neutral")
		parts.push(`grade=${s.background.colorGrade}`);
	if (s.background?.imageUrl) parts.push("bg-image");
	if (s.background?.videoUrl) parts.push("bg-video");
	if (s.text) parts.push(`text="${truncate(s.text, 40)}"`);
	if (s.emphasisText) parts.push(`emphasis="${truncate(s.emphasisText, 30)}"`);
	if (s.subtitleText) parts.push(`subtitle="${truncate(s.subtitleText, 40)}"`);
	if (s.statValue) parts.push(`stat=${s.statValue}`);
	if (s.statLabel) parts.push(`statLabel="${truncate(s.statLabel, 40)}"`);
	if (s.bulletItems) parts.push(`bullets=[${s.bulletItems.length}]`);
	if (s.quoteText) parts.push(`quote="${truncate(s.quoteText, 40)}"`);
	if (s.transition && s.transition !== "none")
		parts.push(`transition=${s.transition}`);
	if (s.voiceover) parts.push("voiceover");
	if (s.locked) parts.push("LOCKED");
	if (s.muted) parts.push("muted");
	return `- ${parts.join(" · ")}`;
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
