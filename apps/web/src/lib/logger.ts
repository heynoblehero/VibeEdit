type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  source?: string;
}

const LOG_HISTORY: LogEntry[] = [];
const MAX_HISTORY = 500;

function formatEntry(entry: LogEntry): string {
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
  const src = entry.source ? `[${entry.source}]` : "";
  return `${entry.timestamp} [${entry.level.toUpperCase()}] ${src} ${entry.message}${ctx}`;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>, source?: string): void {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    source,
  };

  LOG_HISTORY.push(entry);
  if (LOG_HISTORY.length > MAX_HISTORY) LOG_HISTORY.shift();

  const formatted = formatEntry(entry);
  switch (level) {
    case "error": console.error(formatted); break;
    case "warn": console.warn(formatted); break;
    case "debug": if (process.env.NODE_ENV === "development") console.debug(formatted); break;
    default: console.log(formatted);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>, src?: string) => log("debug", msg, ctx, src),
  info: (msg: string, ctx?: Record<string, unknown>, src?: string) => log("info", msg, ctx, src),
  warn: (msg: string, ctx?: Record<string, unknown>, src?: string) => log("warn", msg, ctx, src),
  error: (msg: string, ctx?: Record<string, unknown>, src?: string) => log("error", msg, ctx, src),
  getHistory: () => [...LOG_HISTORY],
};
