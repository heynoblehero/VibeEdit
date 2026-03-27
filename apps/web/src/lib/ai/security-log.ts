type Severity = "info" | "warn" | "error" | "critical";

interface SecurityEvent {
  timestamp: string;
  severity: Severity;
  event: string;
  ip?: string;
  details?: Record<string, unknown>;
}

const securityLog: SecurityEvent[] = [];
const MAX_LOG_SIZE = 1000;

export function logSecurity(severity: Severity, event: string, details?: Record<string, unknown>): void {
  const entry: SecurityEvent = {
    timestamp: new Date().toISOString(),
    severity,
    event,
    details,
  };

  // Always console log for dev
  const prefix = `[SECURITY:${severity.toUpperCase()}]`;
  if (severity === "critical" || severity === "error") {
    console.error(prefix, event, details || "");
  } else if (severity === "warn") {
    console.warn(prefix, event, details || "");
  } else {
    console.log(prefix, event, details || "");
  }

  // Store in-memory for audit
  securityLog.push(entry);
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.shift();
  }
}

export function getSecurityLog(): SecurityEvent[] {
  return [...securityLog];
}
