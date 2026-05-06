import type { Project, ProjectUpload } from "@/lib/scene-schema";

/**
 * Snapshot of the user's available assets at run-start. The client
 * passes this in the POST /runs body — the agent reasons over it in
 * the survey/plan stage so it knows whether to request uploads or
 * stick to text-driven scene types.
 *
 * v1 only carries project-scoped uploads + the canonical character /
 * sfx libraries. Phase C would add Pexels/Pixabay query results.
 */
export interface AssetSurvey {
	projectName: string;
	projectScript?: string;
	existingScenes: number;
	uploads: Array<Pick<ProjectUpload, "id" | "name" | "url" | "type">>;
	characters: Array<{ id: string; name: string; src: string }>;
	sfx: Array<{ id: string; name: string; src: string }>;
}

/** Build a survey from a Project + the client-side asset stores. */
export function buildSurvey(input: {
	project: Project;
	characters: Array<{ id: string; name: string; src: string }>;
	sfx: Array<{ id: string; name: string; src: string }>;
}): AssetSurvey {
	const { project, characters, sfx } = input;
	return {
		projectName: project.name,
		projectScript: project.script || undefined,
		existingScenes: project.scenes.length,
		uploads: (project.uploads ?? []).map((u) => ({
			id: u.id,
			name: u.name,
			url: u.url,
			type: u.type,
		})),
		characters: characters.slice(0, 24),
		sfx: sfx.slice(0, 24),
	};
}

/**
 * Render the survey into a markdown block for the agent's first user
 * message. Compact + scannable — avoid drowning the model in URLs the
 * user hasn't asked for.
 */
export function renderSurveyBlock(survey: AssetSurvey): string {
	const lines: string[] = [];
	lines.push("## Available assets");
	lines.push(`Project: "${survey.projectName}"`);
	if (survey.projectScript) {
		lines.push(
			`Existing script (first 400 chars): ${survey.projectScript.slice(0, 400).trim()}${
				survey.projectScript.length > 400 ? "…" : ""
			}`,
		);
	}
	lines.push(`Existing scenes: ${survey.existingScenes}`);

	if (survey.uploads.length > 0) {
		lines.push("");
		lines.push(`### Project uploads (${survey.uploads.length})`);
		for (const u of survey.uploads.slice(0, 30)) {
			lines.push(`- ${u.name}${u.type ? ` (${u.type})` : ""} → ${u.url}`);
		}
		if (survey.uploads.length > 30) {
			lines.push(`- (+${survey.uploads.length - 30} more, omitted)`);
		}
	} else {
		lines.push("");
		lines.push("### Project uploads: none yet");
	}

	if (survey.characters.length > 0) {
		lines.push("");
		lines.push(`### Character images (${survey.characters.length})`);
		for (const c of survey.characters) {
			lines.push(`- ${c.name} → ${c.src}`);
		}
	}

	if (survey.sfx.length > 0) {
		lines.push("");
		lines.push(`### SFX (${survey.sfx.length})`);
		for (const s of survey.sfx) {
			lines.push(`- ${s.name} → ${s.src}`);
		}
	}

	return lines.join("\n");
}
