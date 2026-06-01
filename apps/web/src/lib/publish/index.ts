import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for OAuth tokens stored in publishConnections.
// Key must be a 32-byte hex string in PUBLISH_TOKEN_SECRET env var.
function getKey(): Buffer {
  const secret = process.env.PUBLISH_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PUBLISH_TOKEN_SECRET must be at least 32 chars");
  }
  return Buffer.from(secret.slice(0, 32), "utf8");
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ── YouTube upload ────────────────────────────────────────────────────────────

export type YouTubeUploadOpts = {
  accessToken: string;
  videoPath: string;
  title: string;
  description?: string;
  privacyStatus?: "public" | "unlisted" | "private";
};

export async function uploadToYouTube(opts: YouTubeUploadOpts): Promise<string> {
  const { readFileSync, statSync } = await import("node:fs");
  const fs = readFileSync(opts.videoPath);
  const size = statSync(opts.videoPath).size;

  // Step 1: initiate resumable upload session
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({
        snippet: { title: opts.title.slice(0, 100), description: opts.description ?? "" },
        status: { privacyStatus: opts.privacyStatus ?? "private" },
      }),
    },
  );
  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`YouTube init failed ${initRes.status}: ${text}`);
  }
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube did not return upload URL");

  // Step 2: upload the file
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(size) },
    body: fs,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube upload failed ${uploadRes.status}: ${text}`);
  }
  const data = (await uploadRes.json()) as { id?: string };
  if (!data.id) throw new Error("YouTube did not return video ID");
  return `https://www.youtube.com/watch?v=${data.id}`;
}

// ── TikTok upload ─────────────────────────────────────────────────────────────

export type TikTokUploadOpts = {
  accessToken: string;
  videoPath: string;
  title: string;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
};

export async function uploadToTikTok(opts: TikTokUploadOpts): Promise<string> {
  const { readFileSync, statSync } = await import("node:fs");
  const size = statSync(opts.videoPath).size;

  // Step 1: init upload
  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: opts.title.slice(0, 150),
        privacy_level: opts.privacyLevel ?? "SELF_ONLY",
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    }),
  });
  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`TikTok init failed ${initRes.status}: ${text}`);
  }
  const initData = (await initRes.json()) as {
    data?: { publish_id?: string; upload_url?: string };
  };
  const uploadUrl = initData.data?.upload_url;
  const publishId = initData.data?.publish_id;
  if (!uploadUrl || !publishId) throw new Error("TikTok did not return upload URL");

  // Step 2: upload
  const video = readFileSync(opts.videoPath);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: video,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`TikTok upload failed ${uploadRes.status}: ${text}`);
  }
  return `https://www.tiktok.com/ (publish_id: ${publishId})`;
}

// ── Unified upload helper ─────────────────────────────────────────────────────

export async function uploadVideo(opts: {
  accessToken: string;
  platform: string;
  videoPath: string;
  title: string;
  description?: string;
}): Promise<string> {
  if (opts.platform === "youtube") {
    return uploadToYouTube({
      accessToken: opts.accessToken,
      videoPath: opts.videoPath,
      title: opts.title,
      description: opts.description,
      privacyStatus: "public",
    });
  }
  if (opts.platform === "tiktok") {
    return uploadToTikTok({
      accessToken: opts.accessToken,
      videoPath: opts.videoPath,
      title: opts.title,
      privacyLevel: "PUBLIC_TO_EVERYONE",
    });
  }
  throw new Error(`unsupported platform: ${opts.platform}`);
}
