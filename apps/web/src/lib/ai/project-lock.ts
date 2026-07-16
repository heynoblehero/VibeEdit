// Per-project async mutex.
//
// Phase 2b runs several sub-agents concurrently, each editing a different scene
// of the same index.html. Their file writes are read-modify-write (read the
// latest html, replace one scene, write it back). Without serialization two
// concurrent writers can lose-update: A reads, B reads the same bytes, A writes,
// B writes over A. Wrapping each RMW in withProjectLock makes them atomic against
// each other — the write is milliseconds, so serializing it costs ~nothing while
// the slow part (the agents' reasoning) still runs in parallel.
//
// In-process only (single Node server); keyed by user+project so different
// projects never block each other. The tail-chaining pattern guarantees FIFO
// fairness and that a throwing critical section still releases the lock.

const tails = new Map<string, Promise<unknown>>();

export function projectLockKey(userId: string, projectId: string): string {
  return `${userId}:${projectId}`;
}

/**
 * Run `fn` while holding the lock for (userId, projectId). Concurrent callers for
 * the same project are serialized in call order; different projects run freely.
 * The lock is released even if `fn` rejects, and the caller still sees the
 * rejection.
 */
export async function withProjectLock<T>(
  userId: string,
  projectId: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const key = projectLockKey(userId, projectId);
  const previous = tails.get(key) ?? Promise.resolve();
  // Chain our turn after whatever is queued; swallow the predecessor's result/
  // error so one caller's failure doesn't cascade to the next.
  const run = previous.then(
    () => fn(),
    () => fn(),
  );
  // The tail is the settle of `run` (never rejects) so the next caller waits for
  // us regardless of outcome.
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  // Best-effort cleanup: once we're the last in line, drop the map entry so idle
  // projects don't leak keys.
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
