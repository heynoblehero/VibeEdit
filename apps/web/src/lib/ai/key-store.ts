/**
 * Server-side API key store.
 * Keys are stored in-memory on the server (per-process).
 * In production, use encrypted cookies or a secrets manager.
 */

const keyStore = new Map<string, string>();

export function setApiKey(service: string, key: string): void {
  keyStore.set(service, key);
}

export function getApiKey(service: string): string | undefined {
  return keyStore.get(service);
}

export function hasApiKey(service: string): boolean {
  return keyStore.has(service) && keyStore.get(service)!.length > 0;
}

export function clearApiKey(service: string): void {
  keyStore.delete(service);
}

export function listConfiguredServices(): string[] {
  return Array.from(keyStore.entries())
    .filter(([_, v]) => v.length > 0)
    .map(([k]) => k);
}
