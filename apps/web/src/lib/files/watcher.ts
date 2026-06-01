import chokidar, { FSWatcher } from "chokidar";
import { EventEmitter } from "node:events";
import { projectDir } from "../storage/fs";

type ProjectWatcher = {
  watcher: FSWatcher;
  emitter: EventEmitter;
  subscribers: number;
};

const watchers = new Map<string, ProjectWatcher>();

function key(userId: string, projectId: string): string {
  return `${userId}:${projectId}`;
}

export function subscribe(
  userId: string,
  projectId: string,
  listener: (path: string) => void,
): () => void {
  const k = key(userId, projectId);
  let entry = watchers.get(k);
  if (!entry) {
    const dir = projectDir(userId, projectId);
    const emitter = new EventEmitter();
    const watcher = chokidar.watch(dir, {
      ignored: (p) => p.includes("node_modules") || p.endsWith(".db"),
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });
    const onChange = (p: string) => emitter.emit("change", p);
    watcher.on("add", onChange);
    watcher.on("change", onChange);
    watcher.on("unlink", onChange);
    entry = { watcher, emitter, subscribers: 0 };
    watchers.set(k, entry);
  }
  entry.subscribers++;
  entry.emitter.on("change", listener);
  return () => {
    const e = watchers.get(k);
    if (!e) return;
    e.emitter.off("change", listener);
    e.subscribers--;
    if (e.subscribers <= 0) {
      e.watcher.close().catch(() => {});
      watchers.delete(k);
    }
  };
}

export function notifyChange(userId: string, projectId: string, path: string): void {
  const entry = watchers.get(key(userId, projectId));
  if (entry) entry.emitter.emit("change", path);
}
