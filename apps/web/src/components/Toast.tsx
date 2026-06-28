"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Global toast / notification system.
 *
 *   const toast = useToast();
 *   toast.success("Project renamed");
 *   toast.error("Couldn't delete project");
 *   toast.info("Render queued");
 *   const id = toast.show({ kind: "info", message: "Saving…", duration: 0 }); // sticky
 *   toast.dismiss(id);
 *
 * Mount <ToastProvider> high in the tree (root layout). Toasts stack in the
 * bottom-right, auto-dismiss after `duration` ms (default 4000; 0 = sticky),
 * and are announced to assistive tech via an aria-live region.
 * ──────────────────────────────────────────────────────────────────────── */

export type ToastKind = "success" | "error" | "info";

export type ToastOptions = {
  kind?: ToastKind;
  message: string;
  /** ms before auto-dismiss; 0 keeps it until dismissed. Errors default longer. */
  duration?: number;
};

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
};

type ToastContextValue = {
  show: (opts: ToastOptions) => string;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000;
const MAX_TOASTS = 4;

function makeId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (opts: ToastOptions): string => {
      const id = makeId();
      const kind = opts.kind ?? "info";
      const duration = opts.duration ?? (kind === "error" ? ERROR_DURATION : DEFAULT_DURATION);
      const toast: Toast = { id, kind, message: opts.message, duration };
      setToasts((current) => {
        // Keep the newest, cap the stack so it never floods the viewport.
        const next = [...current, toast];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, duration?: number) => show({ kind: "success", message, duration }),
    [show],
  );
  const error = useCallback(
    (message: string, duration?: number) => show({ kind: "error", message, duration }),
    [show],
  );
  const info = useCallback(
    (message: string, duration?: number) => show({ kind: "info", message, duration }),
    [show],
  );

  // Clear all pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ show, success, error, info, dismiss }),
    [show, success, error, info, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Access the toast API. Safe to call anywhere under <ToastProvider>; outside it
 * the calls become no-ops (so feature code never crashes if the provider is
 * missing in, say, a test or storybook context).
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  // No provider — return inert handlers so callers don't have to null-check.
  return NOOP_TOAST;
}

const NOOP_TOAST: ToastContextValue = {
  show: () => "",
  success: () => "",
  error: () => "",
  info: () => "",
  dismiss: () => {},
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      // Polite live region: announces non-disruptively. Errors get assertive
      // semantics via role="alert" on the individual toast below.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { kind, message, id } = toast;
  const accent =
    kind === "success"
      ? "border-[var(--color-success)]/40 text-[var(--color-success)]"
      : kind === "error"
        ? "border-[var(--color-danger)]/40 text-[var(--color-danger)]"
        : "border-[var(--color-info)]/40 text-[var(--color-info)]";

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-[var(--color-surface)] px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl ${accent}`}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {kind === "success" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : kind === "error" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.5" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="11" x2="12" y2="16" />
            <line x1="12" y1="8" x2="12" y2="8" />
          </svg>
        )}
      </span>
      <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--color-fg)]">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
