/**
 * Rights gate for imported footage.
 *
 * VibeEdit lets users pull clips from external videos, but re-hosting someone
 * else's copyrighted footage in a rendered output is a liability. So we split
 * intent into two lanes:
 *
 *   - "recreate": the AI studies the clip and generates an ORIGINAL composition.
 *     The source footage is never re-hosted → always allowed, basis is
 *     "reference-only".
 *   - "reuse": the actual downloaded footage is placed into a render. Allowed
 *     ONLY when the user attests ownership/licence, or the source is detected
 *     Creative Commons (via the platform's own licence metadata).
 *
 * "save" (stash the clip for later, in a project or the personal library) is
 * treated like "reuse" for gating purposes — the footage lands on disk and could
 * later be dropped into a render, so it needs the same basis.
 */

export type RightsBasis = "reference-only" | "owner-attested" | "cc";

export type ImportAction = "save" | "reuse" | "recreate";

export class RightsError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "RightsError";
  }
}

// yt-dlp reports a per-video `license` string on platforms that expose it
// (YouTube's "Creative Commons Attribution" is the common one). Anything matching
// this is treated as CC-cleared for reuse.
function isCreativeCommons(license: string | undefined | null): boolean {
  if (!license) return false;
  return /creative commons|(^|\b)cc(\b|-)/i.test(license);
}

/**
 * Resolve the rights basis for an import, or throw RightsError (403) when the
 * requested action isn't permitted for the given source.
 */
export function resolveRightsBasis(opts: {
  action: ImportAction;
  attested?: boolean;
  license?: string | null;
}): RightsBasis {
  if (opts.action === "recreate") {
    // Original output — source footage is never published.
    return "reference-only";
  }

  // save / reuse — the footage itself is retained and could be rendered.
  if (opts.attested) return "owner-attested";
  if (isCreativeCommons(opts.license)) return "cc";

  throw new RightsError(
    "This action reuses the original footage. Confirm you own it or that it's " +
      "licensed for reuse, or choose 'Recreate style' to generate an original version instead.",
  );
}
