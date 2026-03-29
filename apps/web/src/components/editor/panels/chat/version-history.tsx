"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { storageService } from "@/services/storage/service";
import { restoreProjectFromSnapshot } from "@/lib/ai/snapshot-restore";
import { useEditor } from "@/hooks/use-editor";

interface VersionEntry {
  id: string;
  label: string;
  timestamp: number;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function VersionHistory({
  projectId,
  onRestore,
}: {
  projectId: string;
  onRestore: () => void;
}) {
  const editor = useEditor();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    storageService.loadVersionSnapshots({ projectId }).then(setVersions).catch(() => {});
  }, [isOpen, projectId]);

  const handleRestore = async (snapshotId: string) => {
    setIsRestoring(true);
    try {
      const snapshot = await storageService.loadVersionSnapshot({ projectId, snapshotId });
      if (snapshot) {
        await restoreProjectFromSnapshot(editor, snapshot as any);
        onRestore();
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setIsRestoring(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
        title="Version history"
      >
        <History className="h-3.5 w-3.5" />
        History
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-border/40 bg-card/90 backdrop-blur-xl shadow-lg">
          <div className="sticky top-0 bg-card/80 backdrop-blur-sm border-b border-border/30 px-3 py-2">
            <span className="text-xs font-semibold font-[family-name:var(--font-display)] text-foreground">Version History</span>
          </div>
          {versions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No versions yet. Versions are created each time you send a message.
            </div>
          ) : (
            <div className="py-1">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => handleRestore(version.id)}
                  disabled={isRestoring}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/50 transition-all duration-200 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{version.label}</p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(version.timestamp)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
