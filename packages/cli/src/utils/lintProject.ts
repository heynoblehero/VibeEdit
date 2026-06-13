import { lintProject as lintProjectCore, type ProjectLintResult } from "@hyperframes/core/lint";
import type { ProjectDir } from "./project.js";

export type { ProjectLintResult };

/**
 * Lint the root index.html and all sub-compositions in the compositions/ dir.
 *
 * The implementation lives in `@hyperframes/core/lint` (pure filesystem/string
 * analysis, no CLI deps) so it can be shared with the web app's agent. This is
 * a thin wrapper preserving the CLI's `ProjectDir` calling convention.
 */
export function lintProject(project: ProjectDir): ProjectLintResult {
  return lintProjectCore(project.dir);
}

/**
 * Determine whether a render should be blocked based on lint results and strict mode.
 * --strict blocks on errors; --strict-all blocks on errors or warnings.
 */
export function shouldBlockRender(
  strictErrors: boolean,
  strictAll: boolean,
  totalErrors: number,
  totalWarnings: number,
): boolean {
  return (strictErrors && totalErrors > 0) || (strictAll && (totalErrors > 0 || totalWarnings > 0));
}
