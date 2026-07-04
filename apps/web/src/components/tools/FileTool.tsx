"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Generic upload → process → download UI shared by the free ffmpeg tools. Each
// tool page passes a config; the drag/drop, quota, option controls, submit, and
// result preview are all handled here.

export type ToolOption = {
  name: string;
  label: string;
  choices: Array<{ value: string; label: string }>;
  default: string;
};

export type FileToolConfig = {
  endpoint: string;
  accept: string; // <input accept> attribute
  hint: string; // small helper text under the dropzone
  options?: ToolOption[];
  submitLabel: string;
  busyLabel: string;
  outputKind: "video" | "audio" | "image" | "download";
  downloadName: string;
  downloadLabel: string;
};

export function FileTool({ config }: { config: FileToolConfig }) {
  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((config.options ?? []).map((option) => [option.name, option.default])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultType, setResultType] = useState<string>("");
  const [quota, setQuota] = useState<{ remaining: number; limit: number; authed: boolean } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(config.endpoint)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setQuota(data))
      .catch(() => {});
  }, [config.endpoint]);

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setNeedsSignup(false);
    setResultUrl(null);
    try {
      const body = new FormData();
      body.append("file", file);
      for (const [name, value] of Object.entries(values)) body.append(name, value);
      const response = await fetch(config.endpoint, { method: "POST", body });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
          needsSignup?: boolean;
        } | null;
        setError(json?.error || `Error ${response.status}`);
        setNeedsSignup(!!json?.needsSignup);
        return;
      }
      const remaining = response.headers.get("x-quota-remaining");
      if (remaining !== null && quota) setQuota({ ...quota, remaining: Number(remaining) });
      const blob = await response.blob();
      setResultType(blob.type);
      setResultUrl(URL.createObjectURL(blob));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {quota && (
        <p className="text-center text-xs text-[var(--color-fg-muted)]">
          {quota.remaining} of {quota.limit} free {quota.remaining === 1 ? "run" : "runs"} left
          today
          {!quota.authed && (
            <>
              {" · "}
              <Link href="/early" className="text-[var(--color-accent)] hover:underline">
                sign up free
              </Link>{" "}
              for more
            </>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) {
            setFile(dropped);
            setResultUrl(null);
          }
        }}
        className="w-full cursor-pointer rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)] p-8 text-center transition-colors hover:border-[var(--color-accent)]"
      >
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          className="hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) {
              setFile(chosen);
              setResultUrl(null);
            }
          }}
        />
        {file ? (
          <div className="text-sm text-[var(--color-fg)]">
            {file.name}{" "}
            <span className="text-[var(--color-fg-muted)]">
              ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </span>
          </div>
        ) : (
          <div className="text-sm text-[var(--color-fg-muted)]">
            Drop your file here, or click to choose
            <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">{config.hint}</div>
          </div>
        )}
      </button>

      {config.options && config.options.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          {config.options.map((option) => (
            <label
              key={option.name}
              className="flex flex-col text-[11px] text-[var(--color-fg-muted)]"
            >
              {option.label}
              <select
                value={values[option.name]}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, [option.name]: event.target.value }))
                }
                className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm text-[var(--color-fg)]"
              >
                {option.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!file || busy}
        className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? config.busyLabel : config.submitLabel}
      </button>

      {error && (
        <div className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
          {needsSignup && (
            <>
              {" "}
              <Link href="/early" className="font-semibold underline">
                Sign up free →
              </Link>
            </>
          )}
        </div>
      )}

      {resultUrl && (
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          {/* Pick the preview from the response's real MIME type (handles the
              converter's dynamic output), falling back to the configured kind. */}
          {(resultType.startsWith("video/") || (!resultType && config.outputKind === "video")) && (
            <video src={resultUrl} controls className="w-full rounded-lg" />
          )}
          {(resultType.startsWith("audio/") || (!resultType && config.outputKind === "audio")) && (
            <audio src={resultUrl} controls className="w-full" />
          )}
          {(resultType.startsWith("image/") || (!resultType && config.outputKind === "image")) && (
            <img src={resultUrl} alt="result" className="mx-auto max-h-80 rounded-lg" />
          )}
          <a
            href={resultUrl}
            download={config.downloadName}
            className="block rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-black hover:opacity-90"
          >
            {config.downloadLabel}
          </a>
        </div>
      )}
    </div>
  );
}
