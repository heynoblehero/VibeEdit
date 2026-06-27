"use client";

// global-error replaces the ROOT layout when a render error escapes it, so it
// must render its own <html>/<body> and can't assume the app's CSS loaded —
// hence inline styles. Its main job is to report React render errors to Sentry
// (the per-segment error.tsx boundaries handle the nicer in-app recovery UI).
import { useEffect } from "react";
import { captureException } from "@/lib/observability/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "app/global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Something went wrong.</h1>
        <p style={{ color: "#a1a1aa", maxWidth: "28rem", margin: 0 }}>
          The app hit an unexpected error. Try again, or reload the page.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "0.5rem",
            border: "none",
            background: "#fafafa",
            color: "#0a0a0a",
            padding: "0.625rem 1.25rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "10px", color: "#71717a" }}>
            ref: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
