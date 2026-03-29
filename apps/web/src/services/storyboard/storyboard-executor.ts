import type { Storyboard, StoryboardScene } from "@/types/storyboard";
import { executeAIActions } from "@/lib/ai/executor";
import type { AIActionResult } from "@/lib/ai/types";

export interface ExecuteStoryboardCallbacks {
  onSceneStart: (sceneIndex: number, scene: StoryboardScene) => void;
  onSceneComplete: (sceneIndex: number, scene: StoryboardScene, results: AIActionResult[]) => void;
  onError: (sceneIndex: number, scene: StoryboardScene, error: string) => void;
  onAllComplete: () => void;
}

export async function executeStoryboard(
  storyboard: Storyboard,
  callbacks: ExecuteStoryboardCallbacks
): Promise<void> {
  const approvedScenes = storyboard.scenes
    .filter((s) => s.approved && !s.executed)
    .sort((a, b) => a.order - b.order);

  if (approvedScenes.length === 0) {
    callbacks.onAllComplete();
    return;
  }

  for (let i = 0; i < approvedScenes.length; i++) {
    const scene = approvedScenes[i];

    callbacks.onSceneStart(i, scene);

    if (!scene.aiActions || scene.aiActions.length === 0) {
      callbacks.onSceneComplete(i, scene, []);
      continue;
    }

    try {
      const results = await executeAIActions(scene.aiActions);

      const hasErrors = results.some((r) => !r.success);
      if (hasErrors) {
        const errorMessages = results
          .filter((r) => !r.success)
          .map((r) => r.error || "Unknown action error")
          .join("; ");
        callbacks.onError(i, scene, errorMessages);
      }

      // Mark complete even if some actions failed - let the user see partial results
      callbacks.onSceneComplete(i, scene, results);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      callbacks.onError(i, scene, message);
      // Continue to next scene rather than aborting
      callbacks.onSceneComplete(i, scene, []);
    }

    // Small delay between scenes to let the editor settle
    if (i < approvedScenes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  callbacks.onAllComplete();
}
