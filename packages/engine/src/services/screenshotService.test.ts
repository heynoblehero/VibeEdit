// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { type Page } from "puppeteer-core";
import { pageScreenshotCapture, cdpSessionCache } from "./screenshotService.js";

// Stub a Page + CDPSession just enough that pageScreenshotCapture can call
// `client.send("Page.captureScreenshot", ...)` and we can inspect the args.
function makeFakePageWithCdp(send: (method: string, params: object) => Promise<{ data: string }>) {
  const fakeSession = { send } as unknown as import("puppeteer-core").CDPSession;
  // Stub a Page object — the WeakMap cache is the only Page-thing used in the
  // path under test, so we can pre-seed it and skip page.createCDPSession().
  const fakePage = {} as Page;
  cdpSessionCache.set(fakePage, fakeSession);
  return fakePage;
}

describe("pageScreenshotCapture supersample plumbing", () => {
  // Minimal 1×1 transparent PNG, base64. The function returns Buffer.from(data, "base64")
  // and we never inspect the bytes — only the params we pass to client.send.
  const ONE_PIXEL_PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

  it("omits `clip` when deviceScaleFactor is undefined (default 1)", async () => {
    const send = vi.fn().mockResolvedValue({ data: ONE_PIXEL_PNG_B64 });
    const page = makeFakePageWithCdp(send);

    await pageScreenshotCapture(page, {
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      format: "jpeg",
      quality: 80,
    });

    expect(send).toHaveBeenCalledWith(
      "Page.captureScreenshot",
      expect.not.objectContaining({ clip: expect.anything() }),
    );
  });

  it("omits `clip` when deviceScaleFactor is exactly 1", async () => {
    const send = vi.fn().mockResolvedValue({ data: ONE_PIXEL_PNG_B64 });
    const page = makeFakePageWithCdp(send);

    await pageScreenshotCapture(page, {
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      format: "jpeg",
      deviceScaleFactor: 1,
    });

    const params = send.mock.calls[0]?.[1] as { clip?: unknown };
    expect(params.clip).toBeUndefined();
  });

  it("passes `clip` with `scale = dpr` when deviceScaleFactor > 1 (the supersample contract)", async () => {
    const send = vi.fn().mockResolvedValue({ data: ONE_PIXEL_PNG_B64 });
    const page = makeFakePageWithCdp(send);

    await pageScreenshotCapture(page, {
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      format: "jpeg",
      deviceScaleFactor: 2,
    });

    expect(send).toHaveBeenCalledWith(
      "Page.captureScreenshot",
      expect.objectContaining({
        clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 2 },
      }),
    );
  });

  it("propagates a non-2 supersample factor (e.g. 720p → 4K = 3×)", async () => {
    const send = vi.fn().mockResolvedValue({ data: ONE_PIXEL_PNG_B64 });
    const page = makeFakePageWithCdp(send);

    await pageScreenshotCapture(page, {
      width: 1280,
      height: 720,
      fps: { num: 30, den: 1 },
      format: "jpeg",
      deviceScaleFactor: 3,
    });

    const params = send.mock.calls[0]?.[1] as { clip?: { scale: number } };
    expect(params.clip?.scale).toBe(3);
  });
});
