import { NextRequest, NextResponse } from "next/server";
import { loadInfraConfig } from "@/lib/infrastructure/config";
import { AwsClient } from "aws4fetch";

/**
 * POST /api/processing/upload
 *
 * Accepts multipart form data with a file, uploads it to the
 * configured cloud storage provider, and returns the file URL.
 *
 * If storage is "local", returns an error (local storage is handled
 * entirely client-side via IndexedDB).
 */
export async function POST(request: NextRequest) {
  try {
    const config = loadInfraConfig();

    if (config.storage.provider === "local") {
      return NextResponse.json(
        { error: "Server-side upload not available: storage is set to local. Use client-side IndexedDB storage." },
        { status: 400 },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const path = formData.get("path") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send as multipart form with 'file' field." },
        { status: 400 },
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: "No path provided. Include a 'path' field for the destination key." },
        { status: 400 },
      );
    }

    // Enforce upload size limit
    const maxBytes = config.limits.maxUploadSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${config.limits.maxUploadSizeMb}MB.` },
        { status: 413 },
      );
    }

    // Sanitize the path
    const safePath = sanitizePath(path);

    // Upload to S3-compatible storage
    const result = await uploadToS3(config.storage, file, safePath);

    return NextResponse.json({
      url: result.url,
      path: safePath,
      size: file.size,
      contentType: file.type,
    });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

//  Helpers 

function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, "") // no directory traversal
    .replace(/^\/+/, "") // no leading slashes
    .replace(/[^a-zA-Z0-9._\-/]/g, "_") // safe chars only
    .slice(0, 512);
}

async function uploadToS3(
  storage: typeof loadInfraConfig extends () => infer C
    ? C extends { storage: infer S } ? S : never
    : never,
  file: File,
  path: string,
): Promise<{ url: string }> {
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("Storage credentials not configured. Set STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY.");
  }

  if (!storage.bucket) {
    throw new Error("Storage bucket not configured. Set STORAGE_BUCKET.");
  }

  if (!storage.endpoint) {
    throw new Error("Storage endpoint not configured. Set STORAGE_ENDPOINT.");
  }

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region: storage.region || "us-east-1",
    service: "s3",
  });

  const uploadUrl = `${storage.endpoint}/${storage.bucket}/${path}`;

  const response = await client.fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(file.size),
    },
    body: file,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`S3 upload failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  // Construct public URL
  // DO Spaces: https://{bucket}.{region}.digitaloceanspaces.com/{path}
  // R2: https://{account-id}.r2.cloudflarestorage.com/{bucket}/{path}
  // S3: https://{bucket}.s3.{region}.amazonaws.com/{path}
  const publicUrl = `${storage.endpoint}/${storage.bucket}/${path}`;

  return { url: publicUrl };
}
