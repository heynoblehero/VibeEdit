/**
 * Save/Load VibeEdit projects as portable JSON files.
 * .vibeedit files contain the full project state (timeline, settings, media references).
 */

export interface VibeEditProject {
  version: 1;
  name: string;
  createdAt: string;
  settings: {
    fps: number;
    canvasSize: { width: number; height: number };
    background: { type: string; color?: string };
  };
  scenes: any[]; // Serialized scenes from EditorCore
  mediaAssets: Array<{
    id: string;
    name: string;
    type: string;
    duration?: number;
    width?: number;
    height?: number;
    // Note: actual file data is NOT included — user must re-attach media
  }>;
}

export function exportProject(editor: any): VibeEditProject {
  const active = editor.project.getActive();
  if (!active) throw new Error("No active project");

  const tracks = editor.timeline.getTracks();
  const assets = editor.media.getAssets();

  return {
    version: 1,
    name: active.metadata?.name || "Untitled",
    createdAt: new Date().toISOString(),
    settings: {
      fps: 30,
      canvasSize: active.settings?.canvasSize || { width: 1920, height: 1080 },
      background: active.settings?.background || { type: "color", color: "#000000" },
    },
    scenes: active.scenes || [{ tracks }],
    mediaAssets: assets.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      duration: a.duration,
      width: a.width,
      height: a.height,
    })),
  };
}

export function downloadProject(project: VibeEditProject): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}.vibeedit`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readProjectFile(file: File): Promise<VibeEditProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(reader.result as string) as VibeEditProject;
        if (project.version !== 1) {
          reject(new Error(`Unsupported project version: ${project.version}`));
          return;
        }
        resolve(project);
      } catch {
        reject(new Error("Invalid .vibeedit file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
