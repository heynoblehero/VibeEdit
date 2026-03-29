/**
 * Cloud Storage Abstraction
 *
 * Provides a unified interface for file storage across:
 * - Local (IndexedDB / OPFS) -- default, zero-config
 * - S3-compatible (AWS S3, DigitalOcean Spaces, Cloudflare R2)
 *
 * DO Spaces, AWS S3, and R2 all use the S3 API, so one implementation covers all three.
 * For S3-compatible providers, file uploads go through a server-side API route
 * that generates pre-signed URLs (the browser never sees raw credentials).
 */

import type { StorageConfig, StorageProvider as StorageProviderType } from "./config";

// ── Interface ────────────────────────────────────────────────────────

export interface CloudStorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;

  /** Upload a file and return its public/accessible URL. */
  upload(file: Blob, path: string): Promise<string>;

  /** Download a file by path. */
  download(path: string): Promise<Blob>;

  /** Delete a file by path. */
  delete(path: string): Promise<void>;

  /** Get a time-limited signed URL for direct access. */
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;

  /** List files under a prefix. Returns paths (keys). */
  list(prefix: string): Promise<string[]>;
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Create a storage provider based on config.
 * Returns LocalStorageProvider by default (no config needed).
 */
export function createStorageProvider(
  config: StorageConfig,
): CloudStorageProvider {
  switch (config.provider) {
    case "s3":
    case "do-spaces":
    case "cloudflare-r2":
      return new S3StorageProvider(config);
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

// ── Local Storage (IndexedDB) ────────────────────────────────────────

const IDB_NAME = "vibeedit-storage";
const IDB_STORE = "files";
const IDB_VERSION = 1;

/**
 * Browser-local storage using IndexedDB.
 * Works offline, zero-config, no server needed.
 * Files are stored as Blobs keyed by path strings.
 */
class LocalStorageProvider implements CloudStorageProvider {
  readonly name = "Local (Browser)";
  readonly type = "local" as const;

  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });

    return this.dbPromise;
  }

  private async tx(
    mode: IDBTransactionMode,
  ): Promise<IDBObjectStore> {
    const db = await this.openDb();
    const transaction = db.transaction(IDB_STORE, mode);
    return transaction.objectStore(IDB_STORE);
  }

  async upload(file: Blob, path: string): Promise<string> {
    const store = await this.tx("readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put(file, path);
      request.onsuccess = () => resolve(`local://${path}`);
      request.onerror = () =>
        reject(new Error(`Failed to store file: ${request.error?.message}`));
    });
  }

  async download(path: string): Promise<Blob> {
    // Strip the local:// prefix if present
    const key = path.replace(/^local:\/\//, "");
    const store = await this.tx("readonly");

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (!request.result) {
          reject(new Error(`File not found: ${key}`));
          return;
        }
        resolve(request.result as Blob);
      };
      request.onerror = () =>
        reject(new Error(`Failed to read file: ${request.error?.message}`));
    });
  }

  async delete(path: string): Promise<void> {
    const key = path.replace(/^local:\/\//, "");
    const store = await this.tx("readwrite");

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete file: ${request.error?.message}`));
    });
  }

  async getSignedUrl(path: string): Promise<string> {
    // Local storage doesn't have signed URLs -- return a blob URL
    const blob = await this.download(path);
    return URL.createObjectURL(blob);
  }

  async list(prefix: string): Promise<string[]> {
    const store = await this.tx("readonly");

    return new Promise((resolve, reject) => {
      const results: string[] = [];
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        const key = cursor.key as string;
        if (key.startsWith(prefix)) {
          results.push(key);
        }
        cursor.continue();
      };

      request.onerror = () =>
        reject(new Error(`Failed to list files: ${request.error?.message}`));
    });
  }
}

// ── S3-Compatible Storage ────────────────────────────────────────────

/**
 * S3-compatible storage provider.
 *
 * Uploads and downloads go through server-side API routes
 * (/api/processing/upload, /api/processing/storage) that hold
 * the actual credentials. The browser never sees the secret key.
 *
 * This works with:
 * - AWS S3
 * - DigitalOcean Spaces (S3-compatible)
 * - Cloudflare R2 (S3-compatible)
 */
class S3StorageProvider implements CloudStorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.type = config.provider;

    const nameMap: Record<string, string> = {
      s3: "AWS S3",
      "do-spaces": "DigitalOcean Spaces",
      "cloudflare-r2": "Cloudflare R2",
    };
    this.name = nameMap[config.provider] || "S3-Compatible Storage";
  }

  async upload(file: Blob, path: string): Promise<string> {
    // Step 1: Get a pre-signed upload URL from our API
    const presignResponse = await fetch("/api/processing/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "presign-upload",
        path,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      }),
    });

    if (!presignResponse.ok) {
      const error = await presignResponse.text().catch(() => "Unknown error");
      throw new Error(`Failed to get upload URL: ${error}`);
    }

    const { uploadUrl, publicUrl } = await presignResponse.json();

    // Step 2: Upload directly to the pre-signed URL
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    return publicUrl || `s3://${this.config.bucket}/${path}`;
  }

  async download(path: string): Promise<Blob> {
    const signedUrl = await this.getSignedUrl(path);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    return response.blob();
  }

  async delete(path: string): Promise<void> {
    const response = await fetch("/api/processing/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        path,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Delete failed: ${error}`);
    }
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const response = await fetch("/api/processing/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "presign-download",
        path,
        expiresIn: expiresInSeconds,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to get signed URL: ${error}`);
    }

    const { url } = await response.json();
    return url;
  }

  async list(prefix: string): Promise<string[]> {
    const response = await fetch("/api/processing/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "list",
        prefix,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`List failed: ${error}`);
    }

    const { keys } = await response.json();
    return keys as string[];
  }
}

// ── Singleton ────────────────────────────────────────────────────────

let _storageInstance: CloudStorageProvider | null = null;

/**
 * Get the global storage provider instance.
 * Lazily initialized from the infra config.
 */
export function getStorageProvider(config?: StorageConfig): CloudStorageProvider {
  if (!_storageInstance || config) {
    // Dynamic import to avoid circular dependency
    const storageConfig = config ?? { provider: "local" as const };
    _storageInstance = createStorageProvider(storageConfig);
  }
  return _storageInstance;
}

/** Reset the singleton (for testing or config changes). */
export function resetStorageProvider(): void {
  _storageInstance = null;
}
