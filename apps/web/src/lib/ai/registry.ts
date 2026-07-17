import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const REGISTRY_ROOT = resolve(process.cwd(), "..", "..", "registry");

export type RegistryEntry = {
  name: string;
  kind: "block" | "component" | "example";
  description: string;
  title?: string;
  tags?: string[];
  width?: number;
  height?: number;
};

let cached: RegistryEntry[] | null = null;

type ItemMeta = {
  title?: string;
  description?: string;
  tags?: string[];
  htmlPath?: string; // absolute path to the composition HTML
  width?: number;
  height?: number;
};

// registry-item.json is the source of truth: it names the composition file
// (files[].path — the blocks use "<name>.html", NOT "index.html") and carries
// the title/description/tags/dimensions.
function readItemMeta(dir: string): ItemMeta {
  try {
    const jsonPath = join(dir, "registry-item.json");
    if (!existsSync(jsonPath)) return {};
    const j = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      title?: string;
      description?: string;
      tags?: string[];
      dimensions?: { width?: number; height?: number };
      files?: Array<{ path?: string; type?: string }>;
    };
    const file = Array.isArray(j.files)
      ? (j.files.find((f) => f.type === "hyperframes:composition") ?? j.files[0])
      : undefined;
    return {
      title: j.title,
      description: j.description,
      tags: Array.isArray(j.tags) ? j.tags : undefined,
      htmlPath: file?.path ? join(dir, file.path) : undefined,
      width: j.dimensions?.width,
      height: j.dimensions?.height,
    };
  } catch {
    return {};
  }
}

// The composition HTML for a block dir: registry-item.json's file, else
// index.html, else <name>.html.
function resolveHtmlPath(dir: string, name: string): string | null {
  const meta = readItemMeta(dir);
  const candidates = [meta.htmlPath, join(dir, "index.html"), join(dir, `${name}.html`)];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

export function listRegistry(): RegistryEntry[] {
  if (cached) return cached;
  const entries: RegistryEntry[] = [];
  const kinds: Array<["block" | "component" | "example", string]> = [
    ["block", "blocks"],
    ["component", "components"],
    ["example", "examples"],
  ];
  for (const [kind, folder] of kinds) {
    const dir = join(REGISTRY_ROOT, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const sub = join(dir, name);
      if (!statSync(sub).isDirectory()) continue;
      const meta = readItemMeta(sub);
      entries.push({
        name,
        kind,
        description: meta.description || meta.title || name,
        title: meta.title,
        tags: meta.tags,
        width: meta.width,
        height: meta.height,
      });
    }
  }
  cached = entries;
  return entries;
}

// Returns the block's composition HTML (capped for token sanity), or null.
export function readRegistryBlock(name: string): string | null {
  for (const k of ["blocks", "components", "examples"]) {
    const dir = join(REGISTRY_ROOT, k, name);
    if (!existsSync(dir)) continue;
    const html = resolveHtmlPath(dir, name);
    if (html) {
      const content = readFileSync(html, "utf8");
      return content.length > 30_000 ? `${content.slice(0, 30_000)}\n<!-- truncated -->` : content;
    }
  }
  return null;
}

// Full, uncapped composition HTML — for serving a live preview iframe.
export function readRegistryHtml(name: string): string | null {
  for (const k of ["blocks", "components", "examples"]) {
    const dir = join(REGISTRY_ROOT, k, name);
    if (!existsSync(dir)) continue;
    const html = resolveHtmlPath(dir, name);
    if (html) return readFileSync(html, "utf8");
  }
  return null;
}

export function registryIndexText(): string {
  const entries = listRegistry();
  const byKind: Record<string, RegistryEntry[]> = {};
  for (const e of entries) {
    (byKind[e.kind] ||= []).push(e);
  }
  const out: string[] = [];
  for (const [kind, list] of Object.entries(byKind)) {
    out.push(`\n## ${kind}s (${list.length})`);
    for (const e of list) {
      out.push(`- \`${e.name}\` — ${e.description}`);
    }
  }
  return out.join("\n");
}
