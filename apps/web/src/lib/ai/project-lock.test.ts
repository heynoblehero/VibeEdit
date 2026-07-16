import { describe, expect, it } from "bun:test";
import { withProjectLock } from "./project-lock";

describe("withProjectLock", () => {
  it("serializes concurrent read-modify-write so no update is lost", async () => {
    // Shared "file" both critical sections mutate via read → (async gap) → write.
    let store = "";
    const rmw = (text: string) =>
      withProjectLock("u1", "p1", async () => {
        const current = store; // read
        await new Promise((r) => setTimeout(r, 5)); // force interleave window
        store = `${current}${text}`; // write
      });
    await Promise.all([rmw("A"), rmw("B"), rmw("C")]);
    // Without the lock, the await gap would drop updates (final would be one letter).
    expect(store.length).toBe(3);
    expect(store.split("").sort().join("")).toBe("ABC");
  });

  it("runs different projects concurrently (no cross-project blocking)", async () => {
    const order: string[] = [];
    const slowP1 = withProjectLock("u1", "p1", async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push("p1");
    });
    const fastP2 = withProjectLock("u1", "p2", async () => {
      order.push("p2");
    });
    await Promise.all([slowP1, fastP2]);
    // p2 must finish first despite p1 being requested first — they don't share a lock.
    expect(order).toEqual(["p2", "p1"]);
  });

  it("releases the lock when a critical section throws, and propagates the error", async () => {
    const boom = withProjectLock("u1", "p3", async () => {
      throw new Error("boom");
    });
    await expect(boom).rejects.toThrow("boom");
    // A subsequent acquire on the same key still runs (lock wasn't left held).
    const after = await withProjectLock("u1", "p3", async () => "ok");
    expect(after).toBe("ok");
  });

  it("preserves FIFO order for the same project", async () => {
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3, 4].map((n) =>
        withProjectLock("u1", "p4", async () => {
          await new Promise((r) => setTimeout(r, 1));
          order.push(n);
        }),
      ),
    );
    expect(order).toEqual([1, 2, 3, 4]);
  });
});
