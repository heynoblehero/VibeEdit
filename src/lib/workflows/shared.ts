/** Helpers shared across workflow definitions. */

export function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function writeScript(
  prompt: string,
  targetLines: number,
  orientation: "landscape" | "portrait",
): Promise<string> {
  const res = await fetch("/api/script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: prompt, targetLines, orientation }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `script failed (${res.status})`);
  return data.script as string;
}

export async function generateImages(
  prompts: string[],
  styleHint: string,
  orientation: "landscape" | "portrait",
): Promise<Array<{ url: string; prompt: string }>> {
  const size = orientation === "portrait" ? "1024x1536" : "1536x1024";
  const res = await fetch("/api/generate-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompts, size, styleHint }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `images failed (${res.status})`);
  return data.images as Array<{ url: string; prompt: string }>;
}
