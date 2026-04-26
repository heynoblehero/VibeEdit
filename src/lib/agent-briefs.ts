interface CinematicShortBriefInput {
  topic: string;
  orientation: "landscape" | "portrait";
  uploads?: Array<{ name: string; url: string; type?: string }>;
}

// Cheap heuristic: detect a likely scene template from the user's goal
// text so the brief can suggest applySceneTemplate as step 3.5.
function detectTemplateHint(topic: string): string | null {
  const t = topic.toLowerCase();
  if (/\b(\d+\s+(things|tips|reasons|ways|signs|mistakes))\b/.test(t)) return "5_tips";
  if (/\b(before|after|vs\.?|versus|compared to)\b/.test(t)) return "before_after";
  if (/\b(how to|tutorial|step.by.step|guide)\b/.test(t)) return "tutorial_intro";
  if (/\b(launch|introducing|new|reveal|product|announcing)\b/.test(t)) return "product_reveal";
  if (/\b(why|how does|what is|explain)\b/.test(t)) return "explainer";
  return null;
}

// Shared so /cinematic-short and CreateProjectDialog can't drift.
export function buildCinematicShortBrief({
  topic,
  orientation,
  uploads = [],
}: CinematicShortBriefInput): string {
  const ratio = orientation === "portrait" ? "9:16 short" : "16:9 piece";
  const tmplHint = detectTemplateHint(topic);
  const lines = [
    `Make a cinematic ${ratio} about: ${topic}`,
    "",
    "Run this loop autonomously, in order:",
    "1. writeNarrativeSpine(promise, stakes, reveal)",
    "2. researchTopic for the subject (visual references)",
    tmplHint
      ? `3. applySceneTemplate("${tmplHint}") to stamp a known structure, then planVideo to refine.`
      : "3. planVideo with explicit shot list (mix ≥4 shotTypes, three-act distribution)",
    "3.5. For any named person / character / product that will appear in 2+ scenes: registerSubject(name, description) BEFORE generation. Then pass subjectId on every generateImageForScene that depicts them — keeps the same face/look across scenes via instant-id / flux-redux.",
    "4. For each shot: routeAsset → use upload OR stockSearch OR generateImageForScene (with subjectId when applicable)",
    "5. extractPalette on the hero asset → applyPaletteToProject for visual unity",
    "6. narrateAllScenes",
    "7. generateMusicForProject",
    "8. Add 1-2 SFX beats",
    "9. appendEndScreen for the CTA",
    "10. selfCritique → fix → videoQualityScore → loop until ≥75",
    "11. renderProject 1080p → awaitRender → watchRenderedVideo",
    "12. generatePublishMetadata for titles/caption/hashtags",
    "Don't ask questions — pick defaults and ship.",
  ];
  if (uploads.length > 0) {
    lines.push("", "Uploaded assets you should fold in:");
    for (const u of uploads) {
      lines.push(`- ${u.name} (${u.type || "file"}) at ${u.url}`);
    }
    lines.push("Run analyzeUpload on each before deciding placement.");
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
