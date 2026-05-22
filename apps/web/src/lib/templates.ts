import { readFileSync, existsSync, cpSync } from "node:fs";
import { resolve, join } from "node:path";

export type TemplateMeta = {
	slug: string;
	name: string;
	niche: string;
	ratio: "16:9" | "9:16";
	durationSeconds: number;
	description: string;
	accent: string;
};

function templatesRoot(): string {
	return resolve(process.cwd(), "templates");
}

let cached: TemplateMeta[] | null = null;

export function listTemplates(): TemplateMeta[] {
	if (cached) return cached;
	const registryPath = join(templatesRoot(), "_registry.json");
	if (!existsSync(registryPath)) return (cached = []);
	const raw = readFileSync(registryPath, "utf8");
	const parsed = JSON.parse(raw) as { templates: TemplateMeta[] };
	cached = parsed.templates || [];
	return cached;
}

export function getTemplate(slug: string): TemplateMeta | null {
	return listTemplates().find((t) => t.slug === slug) || null;
}

export function copyTemplateInto(slug: string, destDir: string): boolean {
	// Only allow slugs registered in the manifest — without this, `slug` like
	// `../../etc/passwd` would resolve outside `templates/` and copy arbitrary
	// files into the user's project (path traversal).
	if (!getTemplate(slug)) return false;
	const sourceDir = join(templatesRoot(), slug);
	if (!existsSync(sourceDir)) return false;
	cpSync(sourceDir, destDir, { recursive: true });
	return true;
}
