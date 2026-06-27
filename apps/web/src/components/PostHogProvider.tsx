"use client";

/*
 * Client-side PostHog provider + hook.
 *
 * Wraps the app so browser pageviews and client events are captured. Gated on
 * NEXT_PUBLIC_POSTHOG_KEY — when unset (dev / analytics-off) it renders the
 * children untouched and never loads PostHog, so there's zero network traffic.
 *
 * Usage:
 *   const posthog = usePostHog();
 *   posthog?.capture("button_clicked", { id: "render" });
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PostHog } from "posthog-js";

const PostHogContext = createContext<PostHog | null>(null);

export function usePostHog(): PostHog | null {
  return useContext(PostHogContext);
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!KEY || initialized.current) return;
    initialized.current = true;
    let cancelled = false;
    // Lazy-load the browser SDK so it never ships to users who have analytics
    // disabled and isn't part of the critical-path bundle.
    void import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;
      posthog.init(KEY, {
        api_host: HOST,
        capture_pageview: true,
        capture_pageleave: true,
        person_profiles: "identified_only",
      });
      setClient(posthog);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <PostHogContext.Provider value={client}>{children}</PostHogContext.Provider>;
}
