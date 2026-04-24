import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { bundle } from "@remotion/bundler";

interface BundleState {
  hash: string;
  promise: Promise<string>;
}

let state: BundleState | null = null;

function hashRemotionSources(projectRoot: string): string {
  const dir = path.join(projectRoot, "src", "remotion");
  const h = crypto.createHash("sha1");
  const walk = (current: string) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        h.update(entry.name);
        h.update(fs.readFileSync(full));
      }
    }
  };
  walk(dir);
  // Include scene-schema since the render reads duration from it
  const schemaPath = path.join(projectRoot, "src", "lib", "scene-schema.ts");
  if (fs.existsSync(schemaPath)) {
    h.update(fs.readFileSync(schemaPath));
  }
  return h.digest("hex").slice(0, 16);
}

export function getRemotionBundle(): Promise<string> {
  const projectRoot = process.cwd();
  const hash = hashRemotionSources(projectRoot);

  if (state && state.hash === hash) {
    return state.promise;
  }

  const outDir = path.join(projectRoot, ".next", "cache", "remotion-bundle", hash);

  const promise = (async () => {
    if (fs.existsSync(path.join(outDir, "index.html"))) {
      return outDir;
    }
    const entry = path.join(projectRoot, "src", "remotion", "index.ts");
    await bundle({
      entryPoint: entry,
      outDir,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias ?? {}),
            "@": path.join(projectRoot, "src"),
          },
        },
      }),
    });
    return outDir;
  })();

  state = { hash, promise };
  return promise;
}

export function warmRemotionBundle(): void {
  getRemotionBundle().catch((err) => {
    console.error("[remotion] warm bundle failed:", err);
  });
}
