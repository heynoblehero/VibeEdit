"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Server,
  Monitor,
  Zap,
  HardDrive,
  Cloud,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
} from "lucide-react";
import type {
  ProcessingBackend,
  StorageProvider,
} from "@/lib/infrastructure/config";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InfraSettingsState {
  processingBackend: ProcessingBackend;
  storageProvider: StorageProvider;
  storageBucket: string;
  storageRegion: string;
  storageEndpoint: string;
  transcriptionEndpoint: string;
  segmentationEndpoint: string;
  videoRenderEndpoint: string;
  clipGenerationEndpoint: string;
}

interface ConnectionStatus {
  testing: boolean;
  success: boolean | null;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BACKEND_OPTIONS: {
  value: ProcessingBackend;
  label: string;
  description: string;
  icon: typeof Monitor;
}[] = [
  {
    value: "client",
    label: "Client-side",
    description: "All processing in your browser. No server needed.",
    icon: Monitor,
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Short tasks in browser, long ones offloaded to server.",
    icon: Zap,
  },
  {
    value: "server",
    label: "Server",
    description: "All heavy processing on remote servers.",
    icon: Server,
  },
];

const STORAGE_OPTIONS: {
  value: StorageProvider;
  label: string;
  description: string;
}[] = [
  { value: "local", label: "Local (Browser)", description: "IndexedDB storage, no cloud" },
  { value: "do-spaces", label: "DigitalOcean Spaces", description: "S3-compatible object storage" },
  { value: "s3", label: "AWS S3", description: "Amazon S3 buckets" },
  { value: "cloudflare-r2", label: "Cloudflare R2", description: "Zero egress fees" },
];

const ENDPOINT_FIELDS: {
  key: keyof Pick<
    InfraSettingsState,
    "transcriptionEndpoint" | "segmentationEndpoint" | "videoRenderEndpoint" | "clipGenerationEndpoint"
  >;
  label: string;
  description: string;
  placeholder: string;
}[] = [
  {
    key: "transcriptionEndpoint",
    label: "Transcription",
    description: "Whisper speech-to-text (GPU recommended)",
    placeholder: "https://api.replicate.com/v1/...",
  },
  {
    key: "segmentationEndpoint",
    label: "Segmentation",
    description: "Background removal / RMBG-1.4 (GPU recommended)",
    placeholder: "https://api.replicate.com/v1/...",
  },
  {
    key: "videoRenderEndpoint",
    label: "Video Render",
    description: "Frame-by-frame video export (CPU intensive)",
    placeholder: "https://your-modal-app.modal.run/render",
  },
  {
    key: "clipGenerationEndpoint",
    label: "Clip Generation",
    description: "Batch auto-clip pipeline",
    placeholder: "https://your-modal-app.modal.run/clips",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InfrastructureSettings() {
  const [settings, setSettings] = useState<InfraSettingsState>({
    processingBackend: "client",
    storageProvider: "local",
    storageBucket: "",
    storageRegion: "",
    storageEndpoint: "",
    transcriptionEndpoint: "",
    segmentationEndpoint: "",
    videoRenderEndpoint: "",
    clipGenerationEndpoint: "",
  });

  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, ConnectionStatus>
  >({});

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load current config from server on mount
  useEffect(() => {
    fetch("/api/processing/config")
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data) {
          setSettings({
            processingBackend: data.processingBackend || "client",
            storageProvider: data.storage?.provider || "local",
            storageBucket: data.storage?.bucket || "",
            storageRegion: data.storage?.region || "",
            storageEndpoint: data.storage?.endpoint || "",
            transcriptionEndpoint: data.endpoints?.transcription || "",
            segmentationEndpoint: data.endpoints?.segmentation || "",
            videoRenderEndpoint: data.endpoints?.videoRender || "",
            clipGenerationEndpoint: data.endpoints?.clipGeneration || "",
          });
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  const updateSetting = useCallback(
    <K extends keyof InfraSettingsState>(
      key: K,
      value: InfraSettingsState[K],
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Test an endpoint connection
  const testConnection = useCallback(
    async (key: string, url: string) => {
      if (!url.trim()) return;

      setConnectionStatus((prev) => ({
        ...prev,
        [key]: { testing: true, success: null, message: "Testing..." },
      }));

      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(10_000),
        }).catch(() => null);

        if (response && (response.ok || response.status === 405 || response.status === 401)) {
          // 405 (Method Not Allowed) or 401 (Unauthorized) means the endpoint exists
          setConnectionStatus((prev) => ({
            ...prev,
            [key]: {
              testing: false,
              success: true,
              message: "Endpoint is reachable",
            },
          }));
        } else {
          setConnectionStatus((prev) => ({
            ...prev,
            [key]: {
              testing: false,
              success: false,
              message: response
                ? `HTTP ${response.status}`
                : "Could not reach endpoint",
            },
          }));
        }
      } catch {
        setConnectionStatus((prev) => ({
          ...prev,
          [key]: {
            testing: false,
            success: false,
            message: "Connection failed or timed out",
          },
        }));
      }
    },
    [],
  );

  // Test storage connection
  const testStorageConnection = useCallback(async () => {
    if (settings.storageProvider === "local") return;

    setConnectionStatus((prev) => ({
      ...prev,
      storage: { testing: true, success: null, message: "Testing..." },
    }));

    try {
      const response = await fetch("/api/processing/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", prefix: "__test__/" }),
      });

      if (response.ok) {
        setConnectionStatus((prev) => ({
          ...prev,
          storage: {
            testing: false,
            success: true,
            message: "Storage connection successful",
          },
        }));
      } else {
        const data = await response.json().catch(() => ({ error: "Unknown error" }));
        setConnectionStatus((prev) => ({
          ...prev,
          storage: {
            testing: false,
            success: false,
            message: data.error || `HTTP ${response.status}`,
          },
        }));
      }
    } catch {
      setConnectionStatus((prev) => ({
        ...prev,
        storage: {
          testing: false,
          success: false,
          message: "Connection test failed",
        },
      }));
    }
  }, [settings.storageProvider]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      // Settings are managed via environment variables on the server.
      // This save action persists them to a local config file or notifies the user.
      const response = await fetch("/api/processing/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        console.error("Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showStorageConfig = settings.storageProvider !== "local";
  const showEndpoints =
    settings.processingBackend === "server" ||
    settings.processingBackend === "hybrid";

  return (
    <div className="space-y-6">
      {/*  Processing Backend  */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Processing Backend
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where heavy tasks (transcription, rendering, ML inference) run.
          </p>
        </div>

        <div className="grid gap-2">
          {BACKEND_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = settings.processingBackend === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  updateSetting("processingBackend", option.value)
                }
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Icon
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isSelected ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                </div>
                {isSelected && (
                  <Badge
                    variant="secondary"
                    className="ml-auto shrink-0 text-[10px]"
                  >
                    Active
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <Separator />

      {/*  Cloud Storage  */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            File Storage
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where media files are stored. Local uses browser storage (IndexedDB).
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">
              Provider
            </Label>
            <Select
              value={settings.storageProvider}
              onValueChange={(v) =>
                updateSetting("storageProvider", v as StorageProvider)
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {opt.description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showStorageConfig && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5">
                    Bucket
                  </Label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="vibeedit-media"
                    value={settings.storageBucket}
                    onChange={(e) =>
                      updateSetting("storageBucket", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5">
                    Region
                  </Label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="nyc3"
                    value={settings.storageRegion}
                    onChange={(e) =>
                      updateSetting("storageRegion", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">
                  Endpoint URL
                </Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="https://nyc3.digitaloceanspaces.com"
                  value={settings.storageEndpoint}
                  onChange={(e) =>
                    updateSetting("storageEndpoint", e.target.value)
                  }
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Credentials are set via environment variables{" "}
                  <code className="text-[11px] bg-muted px-1 rounded">
                    STORAGE_ACCESS_KEY
                  </code>{" "}
                  and{" "}
                  <code className="text-[11px] bg-muted px-1 rounded">
                    STORAGE_SECRET_KEY
                  </code>
                  . They are never exposed to the browser.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testStorageConnection}
                  disabled={connectionStatus.storage?.testing}
                >
                  {connectionStatus.storage?.testing ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  ) : (
                    <Cloud className="h-3 w-3 mr-1.5" />
                  )}
                  Test Connection
                </Button>
                <ConnectionBadge status={connectionStatus.storage} />
              </div>
            </>
          )}
        </div>
      </section>

      {/*  Processing Endpoints  */}
      {showEndpoints && (
        <>
          <Separator />

          <section>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Server className="h-4 w-4" />
                Processing Endpoints
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                URLs for remote processing services. Leave blank to process
                client-side.
              </p>
            </div>

            <div className="space-y-4">
              {ENDPOINT_FIELDS.map((field) => (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      {field.label}
                    </Label>
                    {settings[field.key] && (
                      <button
                        type="button"
                        onClick={() =>
                          testConnection(field.key, settings[field.key])
                        }
                        disabled={connectionStatus[field.key]?.testing}
                        className="text-[11px] text-primary hover:underline disabled:opacity-50"
                      >
                        {connectionStatus[field.key]?.testing
                          ? "Testing..."
                          : "Test"}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    {field.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-9 text-sm flex-1"
                      placeholder={field.placeholder}
                      value={settings[field.key]}
                      onChange={(e) => updateSetting(field.key, e.target.value)}
                    />
                    <ConnectionBadge status={connectionStatus[field.key]} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Separator />

      {/*  Save  */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Changes take effect after saving. Storage credentials are managed via
          environment variables.
        </p>
        <Button size="sm" onClick={saveSettings} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : null}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Connection status badge                                            */
/* ------------------------------------------------------------------ */

function ConnectionBadge({
  status,
}: {
  status: ConnectionStatus | undefined;
}) {
  if (!status || status.testing) return null;

  if (status.success === true) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-600">
        <CheckCircle className="h-3 w-3" />
        {status.message}
      </span>
    );
  }

  if (status.success === false) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-destructive">
        <XCircle className="h-3 w-3" />
        {status.message}
      </span>
    );
  }

  return null;
}
