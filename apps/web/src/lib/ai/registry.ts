import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const REGISTRY_ROOT = resolve(process.cwd(), "..", "..", "registry");

export type RegistryEntry = {
  name: string;
  kind: "block" | "component" | "example";
  description: string;
};

let cached: RegistryEntry[] | null = null;

function readFirstLine(p: string): string {
  try {
    const text = readFileSync(p, "utf8").slice(0, 2000);
    const match = text.match(/<title>([^<]+)<\/title>/i);
    if (match) return match[1].trim();
    return "";
  } catch {
    return "";
  }
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
      const indexPath = join(sub, "index.html");
      const desc = existsSync(indexPath) ? readFirstLine(indexPath) : "";
      entries.push({ name, kind, description: desc || name });
    }
  }
  cached = entries;
  return entries;
}

export function readRegistryBlock(name: string): string | null {
  const kinds = ["blocks", "components", "examples"];
  for (const k of kinds) {
    const p = join(REGISTRY_ROOT, k, name, "index.html");
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      // Cap at 30KB to keep tokens sane
      return content.length > 30_000 ? content.slice(0, 30_000) + "\n<!-- truncated -->" : content;
    }
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
