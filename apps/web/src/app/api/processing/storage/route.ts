import { NextRequest, NextResponse } from "next/server";
import { loadInfraConfig } from "@/lib/infrastructure/config";
import { AwsClient } from "aws4fetch";

/**
 * POST /api/processing/storage
 *
 * Server-side storage operations for S3-compatible providers.
 * The browser calls this to get pre-signed URLs, delete files, or list keys.
 * This keeps credentials server-side only.
 *
 * Actions:
 *   - presign-upload: Generate a pre-signed PUT URL for direct upload
 *   - presign-download: Generate a pre-signed GET URL for direct download
 *   - delete: Delete a file by key
 *   - list: List files under a prefix
 */
export async function POST(request: NextRequest) {
  try {
    const config = loadInfraConfig();

    if (config.storage.provider === "local") {
      return NextResponse.json(
        { error: "Storage API not available: storage provider is 'local'. Use client-side IndexedDB." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 },
      );
    }

    const client = createS3Client(config.storage);

    switch (action) {
      case "presign-upload":
        return handlePresignUpload(client, config.storage, body);
      case "presign-download":
        return handlePresignDownload(client, config.storage, body);
      case "delete":
        return handleDelete(client, config.storage, body);
      case "list":
        return handleList(client, config.storage, body);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: presign-upload, presign-download, delete, list` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[storage] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Storage operation failed" },
      { status: 500 },
    );
  }
}

// ── S3 Client ────────────────────────────────────────────────────────

function createS3Client(
  storage: ReturnType<typeof loadInfraConfig>["storage"],
): AwsClient {
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      "Storage credentials not configured. Set STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY environment variables.",
    );
  }

  return new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region: storage.region || "us-east-1",
    service: "s3",
  });
}

function getObjectUrl(
  storage: ReturnType<typeof loadInfraConfig>["storage"],
  path: string,
): string {
  if (!storage.endpoint || !storage.bucket) {
    throw new Error("Storage endpoint and bucket must be configured.");
  }
  return `${storage.endpoint}/${storage.bucket}/${sanitizePath(path)}`;
}

function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, "")
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9._\-/]/g, "_")
    .slice(0, 512);
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handlePresignUpload(
  client: AwsClient,
  storage: ReturnType<typeof loadInfraConfig>["storage"],
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { path, contentType, size } = body;

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const config = loadInfraConfig();
  const maxBytes = config.limits.maxUploadSizeMb * 1024 * 1024;
  if (typeof size === "number" && size > maxBytes) {
    return NextResponse.json(
      { error: `File too large: max ${config.limits.maxUploadSizeMb}MB` },
      { status: 413 },
    );
  }

  const objectUrl = getObjectUrl(storage, path as string);

  // Create a signed PUT request
  const signedRequest = await client.sign(objectUrl, {
    method: "PUT",
    headers: {
      "Content-Type": (contentType as string) || "application/octet-stream",
    },
    aws: { signQuery: true, allHeaders: true },
  });

  const uploadUrl = signedRequest.url;
  const publicUrl = objectUrl;

  return NextResponse.json({ uploadUrl, publicUrl });
}

async function handlePresignDownload(
  client: AwsClient,
  storage: ReturnType<typeof loadInfraConfig>["storage"],
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { path } = body;

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const objectUrl = getObjectUrl(storage, path);

  // Create a signed GET request
  const signedRequest = await client.sign(objectUrl, {
    method: "GET",
    aws: { signQuery: true },
  });

  return NextResponse.json({ url: signedRequest.url });
}

async function handleDelete(
  client: AwsClient,
  storage: ReturnType<typeof loadInfraConfig>["storage"],
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { path } = body;

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const objectUrl = getObjectUrl(storage, path);

  const response = await client.fetch(objectUrl, { method: "DELETE" });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Delete failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  return NextResponse.json({ deleted: true, path });
}

async function handleList(
  client: AwsClient,
  storage: ReturnType<typeof loadInfraConfig>["storage"],
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { prefix } = body;

  if (!storage.endpoint || !storage.bucket) {
    throw new Error("Storage endpoint and bucket must be configured.");
  }

  const safePrefix = prefix && typeof prefix === "string" ? sanitizePath(prefix) : "";
  const listUrl = `${storage.endpoint}/${storage.bucket}?list-type=2&prefix=${encodeURIComponent(safePrefix)}&max-keys=1000`;

  const response = await client.fetch(listUrl, { method: "GET" });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`List failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const xmlText = await response.text();

  // Parse the S3 ListObjectsV2 XML response to extract keys
  const keys = parseS3ListKeys(xmlText);

  return NextResponse.json({ keys, count: keys.length });
}

/**
 * Simple XML parser for S3 ListObjectsV2 response.
 * Extracts <Key> elements from <Contents> entries.
 */
function parseS3ListKeys(xml: string): string[] {
  const keys: string[] = [];
  const keyRegex = /<Key>(.*?)<\/Key>/g;
  let match: RegExpExecArray | null;

  while ((match = keyRegex.exec(xml)) !== null) {
    keys.push(match[1]);
  }

  return keys;
}
