/**
 * Warm headless-Chrome pool for in-process snapshot capture.
 *
 * The agent's visual-critique loop calls `screenshot_at_time` after every
 * `write_file` — up to 3 iterations per edit. The old path spawned the
 * `hyperframes snapshot` CLI for each call, which paid a fresh Node startup
 * AND a cold Chromium launch (~0.5–1.5s) every time. This module keeps a
 * single Chromium instance alive across calls inside the long-lived web
 * server process (where the render queue already lives), so only the first
 * snapshot of an idle period pays the launch cost.
 *
 * Lifecycle: lazily launched on first `acquireBrowser()`, reused while leases
 * are outstanding, and auto-closed after `SNAPSHOT_BROWSER_IDLE_MS` of no
 * activity so an idle server doesn't hold a browser forever.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Browser } from "puppeteer-core";

const IDLE_TIMEOUT_MS = Number(process.env.SNAPSHOT_BROWSER_IDLE_MS ?? 5 * 60_000);

const CHROME_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--enable-webgl",
  "--use-gl=angle",
  "--use-angle=swiftshader",
];

const SYSTEM_CHROME_PATHS: ReadonlyArray<string> =
  process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
      ];

let browserPromise: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeLeases = 0;

/**
 * Resolve a Chrome executable, mirroring the CLI's `ensureBrowser` order
 * (explicit env → hyperframes chrome cache → system Chrome) but WITHOUT the
 * download fallback — a multi-minute download is not acceptable inside a
 * request. Callers fall back to the CLI path if this throws.
 */
async function resolveChromeExecutable(): Promise<string> {
  const envPath = process.env.HYPERFRAMES_BROWSER_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  try {
    const { getInstalledBrowsers, Browser: BrowserName } = await import("@puppeteer/browsers");
    const cacheDir = join(homedir(), ".cache", "hyperframes", "chrome");
    if (existsSync(cacheDir)) {
      const installed = await getInstalledBrowsers({ cacheDir });
      const match =
        installed.find((b) => b.browser === BrowserName.CHROMEHEADLESSSHELL) ?? installed[0];
      if (match) return match.executablePath;
    }
  } catch {
    // @puppeteer/browsers unavailable or cache unreadable — fall through.
  }

  for (const p of SYSTEM_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    "No Chrome executable found for snapshots. Set HYPERFRAMES_BROWSER_PATH or run `hyperframes doctor`.",
  );
}

/** Whether a Chrome executable can be resolved (does NOT launch one). */
export async function isChromeAvailable(): Promise<boolean> {
  try {
    await resolveChromeExecutable();
    return true;
  } catch {
    return false;
  }
}

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  const executablePath = await resolveChromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: CHROME_LAUNCH_ARGS,
  });
  // If the browser dies (crash, OOM), drop the cached promise so the next
  // acquire relaunches instead of handing out a dead handle.
  browser.on("disconnected", () => {
    if (browserPromise) browserPromise = null;
  });
  return browser;
}

/**
 * Get the shared warm browser, launching it if needed. Every successful
 * acquire MUST be paired with a `releaseBrowser()` (use try/finally).
 */
export async function acquireBrowser(): Promise<Browser> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  activeLeases++;
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  try {
    return await browserPromise;
  } catch (err) {
    // Launch failed — undo this lease so the idle accounting stays correct.
    releaseBrowser();
    throw err;
  }
}

/** Release a lease taken by `acquireBrowser`; arms the idle-close timer when idle. */
export function releaseBrowser(): void {
  activeLeases = Math.max(0, activeLeases - 1);
  if (activeLeases === 0 && browserPromise) {
    idleTimer = setTimeout(() => void closeBrowser(), IDLE_TIMEOUT_MS);
    // Don't let the idle timer keep the process alive on its own.
    idleTimer.unref?.();
  }
}

/**
 * Pre-launch the browser so the first real snapshot isn't the one that pays
 * the cold-start cost. Acquires and immediately releases a lease, which arms
 * the idle-close timer — so if no snapshots follow, the warm browser cleans
 * itself up after the idle window. Returns false (never throws) if no Chrome
 * is available, so callers can warm on a best-effort basis.
 */
export async function warmBrowser(): Promise<boolean> {
  try {
    await acquireBrowser();
    releaseBrowser();
    return true;
  } catch {
    return false;
  }
}

async function closeBrowser(): Promise<void> {
  if (activeLeases > 0 || !browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Already gone / never resolved — nothing to clean up.
  }
}
