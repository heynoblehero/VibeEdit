interface CinematicShortBriefInput {
  topic: string;
  orientation: "landscape" | "portrait";
  uploads?: Array<{ name: string; url: string; type?: string }>;
}

// Shared so /cinematic-short and CreateProjectDialog can't drift.
export function buildCinematicShortBrief({
  topic,
  orientation,
  uploads = [],
}: CinematicShortBriefInput): string {
  const ratio = orientation === "portrait" ? "9:16 short" : "16:9 piece";
  const lines = [
    `Make a cinematic ${ratio} about: ${topic}`,
    "",
    "Run this loop autonomously, in order:",
    "1. writeNarrativeSpine(promise, stakes, reveal)",
    "2. researchTopic for the subject (visual references)",
    "3. planVideo with explicit shot list (mix ≥4 shotTypes, three-act distribution)",
    "4. For each shot: routeAsset → use upload OR stockSearch OR generateImageForScene",
    "5. narrateAllScenes",
    "6. generateMusicForProject",
    "7. Add 1-2 SFX beats",
    "8. selfCritique → fix top issues → videoQualityScore → loop until ≥75",
    "9. renderProject 1080p",
    "10. watchRenderedVideo + report any audio/visual issues",
    "Don't ask questions — pick defaults and ship.",
  ];
  if (uploads.length > 0) {
    lines.push("", "Uploaded assets you should fold in:");
    for (const u of uploads) {
      lines.push(`- ${u.name} (${u.type || "file"}) at ${u.url}`);
    }
  }
  return lines.join("\n");
}

export function buildExpressBrief({
  topic,
  uploads = [],
}: Omit<CinematicShortBriefInput, "orientation">): string {
  const lines = [topic];
  if (uploads.length > 0) {
    lines.push("", "I've uploaded these assets:");
    for (const u of uploads) {
      lines.push(`- ${u.name} (${u.type || "file"}) at ${u.url}`);
    }
    lines.push("Use them in the right places.");
  }
  return lines.join("\n");
}
