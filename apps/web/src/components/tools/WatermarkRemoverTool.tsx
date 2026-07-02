"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const CORNERS = [
  { id: "bottom-right", label: "Bottom-right (Veo default)" },
  { id: "bottom-left", label: "Bottom-left" },
  { id: "bottom-center", label: "Bottom-center" },
  { id: "top-right", label: "Top-right" },
  { id: "top-left", label: "Top-left" },
];

export default function WatermarkRemoverTool() {
  const [file, setFile] = useState<File | null>(null);
  const [corner, setCorner] = useState("bottom-right");
  const [tos, setTos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ remaining: number; limit: number; authed: boolean } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/tools/watermark-remover")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuota(d))
      .catch(() => {});
  }, []);

  async function submit() {
    if (!file || !tos || busy) return;
    setBusy(true);
    setError(null);
    setNeedsSignup(false);
    setResultUrl(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("corner", corner);
      const res = await fetch("/api/tools/watermark-remover", { method: "POST", body });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
          needsSignup?: boolean;
        } | null;
        setError(j?.error || `Error ${res.status}`);
        setNeedsSignup(!!j?.needsSignup);
        return;
      }
      const remaining = res.headers.get("x-quota-remaining");
      if (remaining !== null && quota) setQuota({ ...quota, remaining: Number(remaining) });
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message);
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
              for more &amp; no badge
            </>
          )}
        </p>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) {
            setFile(f);
            setResultUrl(null);
          }
        }}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)] p-8 text-center transition-colors hover:border-[var(--color-accent)]"
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
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
            Drop your AI-generated video here, or click to choose
            <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">
              mp4 / mov / mkv / webm · up to 100 MB · 60s
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col text-[11px] text-[var(--color-fg-muted)]">
          Watermark position
          <select
            value={corner}
            onChange={(e) => setCorner(e.target.value)}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm text-[var(--color-fg)]"
          >
            {CORNERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-2 text-xs text-[var(--color-fg-muted)]">
        <input
          type="checkbox"
          checked={tos}
          onChange={(e) => setTos(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I own or have the rights to this video and I&apos;m removing the visible logo from my own
          AI-generated content. (Invisible provenance watermarks like SynthID are not affected.)
        </span>
      </label>

      <button
        onClick={submit}
        disabled={!file || !tos || busy}
        className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Removing…" : "Remove watermark"}
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
          <video src={resultUrl} controls className="w-full rounded-lg" />
          <a
            href={resultUrl}
            download="cleaned.mp4"
            className="block rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-black hover:opacity-90"
          >
            Download cleaned video
          </a>
        </div>
      )}
    </div>
  );
}
