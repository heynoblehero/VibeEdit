import { type NextRequest, NextResponse } from "next/server";
import { slidingWindowCheck, type WindowLimit } from "@/lib/rate-limit";

/*
 * Front-line rate limiting for budget-sensitive API routes.
 *
 * WHY MIDDLEWARE (not per-route): keeps the limit policy in one place, applies
 * it BEFORE any route handler / model call runs, and (per task constraints)
 * avoids touching individual route files. The in-route, per-user limiter in
 * lib/rate-limit.ts (checkRateLimit) stays as the precise post-auth layer; this
 * is the cheap pre-auth perimeter that protects the Anthropic / Replicate /
 * ElevenLabs / email spend from a single noisy IP.
 *
 * SCOPE: the `matcher` at the bottom lists ONLY the expensive endpoints. Static
 * assets, the Next.js internals, pages, cheap routes, and — critically — the
 * Polar webhook (/api/webhooks/*) are NOT matched and are never rate-limited
 * (Polar retries on non-2xx and signs its payloads; throttling it would drop
 * billing events). Per-method gating below further narrows to the costly verb.
 */

type Rule = {
  /** Which HTTP methods this rule applies to. Other methods pass through. */
  methods: Set<string>;
  /** Endpoint group label — also the rate-limit key namespace. */
  group: string;
  limit: WindowLimit;
  /**
   * When true, the rule applies ONLY to the exact path, not sub-paths. Used for
   * render: only the top-level POST /api/render enqueues a paid job. The
   * sub-routes under /api/render/** (client-save, [id]/share, [id]/reviews,
   * [id]/showcase, [id]/stream, [id]/download) are cheap DB/file ops — and
   * client-save must never be refused — so they are deliberately left
   * unthrottled.
   */
  exact?: boolean;
};

// Per-endpoint limits. Chat and render are the most expensive (model tokens /
// GPU render minutes) so they're strictest. Search/stock hit paid upstream
// media APIs on every GET, moderate. Auth POSTs send verification emails — keep
// abuse-resistant but lenient enough for real retry/typo flows. Waitlist /
// support / bug-report are public unauth forms: lenient per-minute (humans),
// with a daily-ish cap implied by the short window keeping bots in check.
//
// Tunable via env without a redeploy of this file's defaults.
const num = (name: string, fallback: number) => Number(process.env[name] || fallback);

const RULES: Record<string, Rule> = {
  // /api/chat — POST streams an agent turn (Anthropic tokens). Strict.
  "/api/chat": {
    methods: new Set(["POST"]),
    group: "chat",
    limit: { limit: num("RL_CHAT_PER_MIN", 15), windowSec: 60 },
  },
  // /api/render — POST enqueues a render job (Replicate / FFmpeg / GPU). Strict.
  // GET is just status polling for the UI, so it's intentionally NOT limited.
  "/api/render": {
    methods: new Set(["POST"]),
    group: "render",
    limit: { limit: num("RL_RENDER_PER_MIN", 10), windowSec: 60 },
    exact: true,
  },
  // /api/search — GET hits SearXNG / Openverse (paid-ish upstream). Moderate.
  "/api/search": {
    methods: new Set(["GET"]),
    group: "search",
    limit: { limit: num("RL_SEARCH_PER_MIN", 30), windowSec: 60 },
  },
  // /api/auth — POST = sign-in/sign-up/reset → sends verification emails &
  // hashes passwords. Limit POST only; GET (get-session) is called constantly
  // by the app and must never be throttled.
  "/api/auth": {
    methods: new Set(["POST"]),
    group: "auth",
    limit: { limit: num("RL_AUTH_PER_MIN", 20), windowSec: 60 },
  },
  // Public unauth forms — lenient for humans, abuse-resistant for bots.
  "/api/waitlist": {
    methods: new Set(["POST"]),
    group: "waitlist",
    limit: { limit: num("RL_WAITLIST_PER_MIN", 5), windowSec: 60 },
  },
  "/api/support": {
    methods: new Set(["POST"]),
    group: "support",
    limit: { limit: num("RL_SUPPORT_PER_MIN", 5), windowSec: 60 },
  },
  "/api/bug-report": {
    methods: new Set(["POST"]),
    group: "bug-report",
    limit: { limit: num("RL_BUG_PER_MIN", 5), windowSec: 60 },
  },
};

/** Longest-prefix match so /api/render/[id]/... still resolves to the render rule. */
function ruleForPath(pathname: string): Rule | null {
  // Webhooks are explicitly never rate-limited (also excluded by the matcher).
  if (pathname.startsWith("/api/webhooks")) return null;
  let best: Rule | null = null;
  let bestLen = -1;
  for (const [prefix, rule] of Object.entries(RULES)) {
    const matches = rule.exact
      ? pathname === prefix
      : pathname === prefix || pathname.startsWith(prefix + "/");
    if (matches && prefix.length > bestLen) {
      best = rule;
      bestLen = prefix.length;
    }
  }
  return best;
}

/** Best-effort client IP from proxy headers (Dokku / nginx sets these). */
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/*
 * Cheap session fingerprint: if a better-auth session cookie is present we mix
 * a short, NON-reversible slice of the token into the key. This means logged-in
 * users get their own bucket (so they aren't penalised for sharing a NAT/office
 * IP with others) WITHOUT any DB lookup or token verification — exactly the
 * "if cheaply available from the request" the design calls for. We never trust
 * it for identity, only as a bucket discriminator, so a slice is sufficient.
 */
function sessionFingerprint(req: NextRequest): string {
  const cookies = req.cookies;
  const token =
    cookies.get("better-auth.session_token")?.value ||
    cookies.get("__Secure-better-auth.session_token")?.value;
  if (!token) return "anon";
  return token.slice(0, 12);
}

export function middleware(req: NextRequest) {
  const rule = ruleForPath(req.nextUrl.pathname);
  // No matching rule, or a non-costly method (e.g. GET on render) → pass through
  // with zero added latency / state.
  if (!rule || !rule.methods.has(req.method)) {
    return NextResponse.next();
  }

  const key = `${rule.group}:${clientIp(req)}:${sessionFingerprint(req)}`;
  const check = slidingWindowCheck(key, rule.limit);

  if (!check.ok) {
    return new NextResponse(
      JSON.stringify({
        error: "rate_limited",
        message: `Too many requests. Retry in ${check.retryAfterSec}s.`,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(check.retryAfterSec),
          "x-ratelimit-limit": String(check.limit),
          "x-ratelimit-remaining": "0",
        },
      },
    );
  }

  const res = NextResponse.next();
  res.headers.set("x-ratelimit-limit", String(check.limit));
  res.headers.set("x-ratelimit-remaining", String(Math.max(0, check.limit - check.used)));
  return res;
}

/*
 * Matcher: only the expensive API paths. Listing them explicitly (rather than a
 * broad /api/:path*) guarantees the middleware never runs for static assets,
 * _next internals, pages, cheap routes, or the Polar webhook — so normal usage
 * pays no cost and webhooks are structurally exempt.
 */
export const config = {
  matcher: [
    "/api/chat/:path*",
    "/api/render/:path*",
    "/api/search/:path*",
    "/api/auth/:path*",
    "/api/waitlist/:path*",
    "/api/support/:path*",
    "/api/bug-report/:path*",
  ],
};
