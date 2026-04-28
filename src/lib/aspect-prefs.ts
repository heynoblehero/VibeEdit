/**
 * Shared aspect-ratio definitions + the "remember my pick for every
 * new scene" preference.
 *
 * The preference is per-browser (localStorage). When set, the +New
 * scene button skips the picker popover and adds the next scene at
 * the same aspect.
 */

export interface AspectOption {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

export const ASPECT_OPTIONS: AspectOption[] = [
  { id: "9:16", label: "9:16", description: "Reels / TikTok / Shorts", width: 1080, height: 1920 },
  { id: "16:9", label: "16:9", description: "YouTube / landscape", width: 1920, height: 1080 },
  { id: "1:1", label: "1:1", description: "Square — Instagram feed", width: 1080, height: 1080 },
  { id: "4:5", label: "4:5", description: "Vertical feed post", width: 1080, height: 1350 },
  { id: "21:9", label: "21:9", description: "Cinematic widescreen", width: 2520, height: 1080 },
];

const STORE_KEY_ASPECT = "vibeedit:default-aspect";
const STORE_KEY_REMEMBER = "vibeedit:remember-aspect";

export function getDefaultAspect(): AspectOption | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(STORE_KEY_ASPECT);
  return ASPECT_OPTIONS.find((o) => o.id === id) ?? null;
}

export function setDefaultAspect(opt: AspectOption | null): void {
  if (typeof window === "undefined") return;
  if (opt) window.localStorage.setItem(STORE_KEY_ASPECT, opt.id);
  else window.localStorage.removeItem(STORE_KEY_ASPECT);
}

/** Default ON — most users want their first pick to stick. */
export function getRememberAspect(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORE_KEY_REMEMBER);
  return raw === null ? true : raw === "1";
}

export function setRememberAspect(v: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY_REMEMBER, v ? "1" : "0");
}
