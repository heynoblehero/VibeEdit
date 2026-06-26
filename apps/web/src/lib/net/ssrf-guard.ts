/**
 * SSRF guard for server-side fetches of URLs the AI agent (or upstream search
 * results / injected web content) chose. Without this, a prompt-injected agent
 * could make the server fetch internal endpoints — most dangerously the cloud
 * metadata service (169.254.169.254) or internal dokku apps — and exfiltrate
 * the response back into the chat.
 *
 * Mitigation: allow only http(s), reject obvious internal hostnames, resolve the
 * host and block any answer that lands in a private/loopback/link-local/reserved
 * range. (A determined DNS-rebinding attacker can still TOCTOU between this check
 * and the socket connect; pinning the connection to the validated IP would close
 * that, but this stops every practical SSRF against metadata/internal services.)
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true; // this-host, private, loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // private
    if (p[0] === 192 && p[1] === 168) return true; // private
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] === 192 && p[1] === 0 && p[2] === 0) return true; // IETF protocol assignments
    if (p[0] >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (a === "::1" || a === "::") return true; // loopback / unspecified
    if (a.startsWith("fc") || a.startsWith("fd")) return true; // unique local fc00::/7
    if (a.startsWith("fe80")) return true; // link-local
    if (a.startsWith("::ffff:")) return isBlockedIp(a.split(":").pop() || ""); // IPv4-mapped
    return false;
  }
  return true; // unparseable → block
}

/**
 * Throws if `raw` is not a safe, public http(s) URL. Call it (await) immediately
 * before any server-side fetch of an agent/user/third-party-supplied URL.
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`SSRF guard: invalid URL "${String(raw).slice(0, 120)}"`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`SSRF guard: blocked non-http(s) scheme "${u.protocol}"`);
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error(`SSRF guard: blocked internal host "${host}"`);
  }

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    const resolved = await lookup(host, { all: true }).catch(() => []);
    addresses = resolved.map((r) => r.address);
  }
  if (addresses.length === 0) {
    throw new Error(`SSRF guard: could not resolve host "${host}"`);
  }
  for (const ip of addresses) {
    if (isBlockedIp(ip)) {
      throw new Error(
        `SSRF guard: blocked request to private/internal address ${ip} (host "${host}")`,
      );
    }
  }
}
