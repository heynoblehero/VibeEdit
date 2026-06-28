/**
 * SSRF guard for server-side fetches of URLs the AI agent (or upstream search
 * results / injected web content) chose. Without this, a prompt-injected agent
 * could make the server fetch internal endpoints — most dangerously the cloud
 * metadata service (169.254.169.254) or internal dokku apps — and exfiltrate
 * the response back into the chat.
 *
 * Mitigation has two layers:
 *
 *   1. `assertPublicHttpUrl(url)` — allow only http(s), reject obvious internal
 *      hostnames, resolve the host and block any answer in a
 *      private/loopback/link-local/reserved range. Cheap pre-flight check.
 *
 *   2. `safeFetch(url, init)` — the TOCTOU-safe fetch. It does (1), then performs
 *      the request over Node's own http/https client with a custom DNS `lookup`
 *      that re-validates EVERY address the resolver returns at connect time and
 *      hands the socket only a vetted public IP. Because the validation and the
 *      socket connect share the same resolved address, a DNS-rebinding attacker
 *      can no longer flip the host to an internal IP in the gap between the check
 *      and the connect — the connection is pinned to the IP that passed the
 *      block-list. The original Host header and TLS SNI (`servername`) are
 *      preserved so virtual-hosted / SNI-dependent public servers still work.
 *
 * Adoption note for files outside this module's ownership: the agent-controlled
 * fetch call sites in `lib/ai/tools.ts` (currently `await assertPublicHttpUrl(url)`
 * immediately followed by `await fetch(url, …)` — around lines 606, 717 and 4259)
 * should be switched from that two-step pattern to a single `await safeFetch(url, …)`
 * to actually close the rebind gap. `safeFetch` returns a standard `Response`, so
 * those call sites keep using `resp.ok`, `resp.status`, `resp.arrayBuffer()`,
 * `resp.json()` unchanged; only the `await assertPublicHttpUrl(url)` line and the
 * `fetch` call collapse into one `safeFetch` call.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import type { LookupAddress } from "node:dns";

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

/** Normalize a hostname for comparison (strip IPv6 brackets, lowercase). */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[|\]$/g, "");
}

/** Reject hostnames that name the local machine / internal namespaces by name. */
function assertHostnameAllowed(host: string): void {
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error(`SSRF guard: blocked internal host "${host}"`);
  }
}

/**
 * Throws if `raw` is not a safe, public http(s) URL. Call it (await) immediately
 * before any server-side fetch of an agent/user/third-party-supplied URL.
 *
 * NOTE: this is a pre-flight check only. It does not pin the connection, so a
 * DNS-rebinding attacker can in theory flip the host to an internal IP between
 * this check and a subsequent plain `fetch`. Prefer `safeFetch` for the actual
 * request — it re-validates at connect time and pins the socket to the vetted IP.
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
  const host = normalizeHost(u.hostname);
  assertHostnameAllowed(host);

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    const resolved = await dnsLookup(host, { all: true }).catch(() => []);
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

/**
 * A Node `dns.lookup`-shaped function that resolves the host and re-validates
 * every returned address, throwing (so the connect fails) if ANY of them is a
 * blocked/internal address. The first vetted address is handed to the socket, so
 * the connection is pinned to an IP that passed the block-list at connect time —
 * the resolve-and-validate happens in the same step as the connect, eliminating
 * the TOCTOU/DNS-rebind window.
 */
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

function pinnedLookup(
  hostname: string,
  options: { all?: boolean } | number | LookupCallback,
  callback?: LookupCallback,
): void {
  const cb = (typeof options === "function" ? options : callback) as LookupCallback;
  const wantAll = typeof options === "object" && options !== null && options.all === true;

  const host = normalizeHost(hostname);
  const resolved: Promise<LookupAddress[]> = net.isIP(host)
    ? Promise.resolve([{ address: host, family: net.isIPv6(host) ? 6 : 4 }])
    : dnsLookup(host, { all: true });

  resolved.then(
    (list) => {
      for (const entry of list) {
        if (isBlockedIp(entry.address)) {
          cb(
            new Error(
              `SSRF guard: blocked request to private/internal address ${entry.address} (host "${host}")`,
            ) as NodeJS.ErrnoException,
            "",
          );
          return;
        }
      }
      if (list.length === 0) {
        cb(new Error(`SSRF guard: could not resolve host "${host}"`) as NodeJS.ErrnoException, "");
        return;
      }
      if (wantAll) {
        cb(null, list);
      } else {
        cb(null, list[0].address, list[0].family);
      }
    },
    (err: Error) => cb(err as NodeJS.ErrnoException, ""),
  );
}

const MAX_REDIRECTS = 5;

/**
 * TOCTOU-safe replacement for `assertPublicHttpUrl(url)` + `fetch(url, init)`.
 *
 * Validates the URL, then performs the request over Node's http/https client
 * with a DNS lookup that re-validates the resolved address and pins the socket
 * to it (preserving Host header + TLS SNI). Follows redirects, re-validating
 * each hop's URL and pinning each hop independently. Returns a standard
 * `Response`, so callers use it exactly like `fetch`.
 *
 * Supports the subset of `RequestInit` the server actually uses: `method`,
 * `headers`, `body` (string/Buffer/Uint8Array), and `signal` (AbortSignal).
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  return requestPinned(rawUrl, init, MAX_REDIRECTS);
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((v, k) => {
      out[k] = v;
    });
  } else if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v;
  } else {
    for (const [k, v] of Object.entries(headers)) out[k] = String(v);
  }
  return out;
}

async function requestPinned(
  rawUrl: string,
  init: RequestInit,
  redirectsLeft: number,
): Promise<Response> {
  await assertPublicHttpUrl(rawUrl);
  const u = new URL(rawUrl);
  const isHttps = u.protocol === "https:";
  const transport = isHttps ? https : http;
  const host = normalizeHost(u.hostname);

  const reqHeaders = headersToObject(init.headers);
  // Ensure the virtual-host Host header is the original hostname (the lookup
  // sends the socket to a vetted IP, but the server must still see the name).
  if (!Object.keys(reqHeaders).some((h) => h.toLowerCase() === "host")) {
    reqHeaders.host = u.host;
  }

  const body = init.body as string | Buffer | Uint8Array | undefined | null;
  const signal = init.signal as AbortSignal | null | undefined;
  const method = (init.method || "GET").toUpperCase();

  return new Promise<Response>((resolvePromise, reject) => {
    const req = transport.request(
      {
        protocol: u.protocol,
        hostname: host,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: reqHeaders,
        // Pin the socket to a re-validated public IP (closes the rebind gap).
        lookup: pinnedLookup,
        // Preserve TLS SNI to the real hostname even though we connect by IP.
        servername: isHttps ? host : undefined,
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        if (location && status >= 300 && status < 400 && status !== 304 && redirectsLeft > 0) {
          res.resume(); // drain
          const next = new URL(location, rawUrl).toString();
          // For 303, and for 301/302 on non-GET/HEAD per fetch semantics, the
          // method becomes GET and the body is dropped.
          const dropBody =
            status === 303 ||
            ((status === 301 || status === 302) && method !== "GET" && method !== "HEAD");
          const nextInit: RequestInit = dropBody
            ? { ...init, method: "GET", body: undefined }
            : init;
          requestPinned(next, nextInit, redirectsLeft - 1).then(resolvePromise, reject);
          return;
        }

        const responseHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue;
          if (Array.isArray(v)) {
            for (const item of v) responseHeaders.append(k, item);
          } else {
            responseHeaders.set(k, String(v));
          }
        }
        // 204/304 and HEAD must not carry a body per the Response contract.
        const noBody = status === 204 || status === 304 || method === "HEAD";
        const webStream = Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>;
        resolvePromise(
          new Response(noBody ? null : webStream, {
            status: status || 200,
            statusText: res.statusMessage || "",
            headers: responseHeaders,
          }),
        );
      },
    );

    if (signal) {
      if (signal.aborted) {
        req.destroy(new DOMException("The operation was aborted.", "AbortError"));
      } else {
        signal.addEventListener(
          "abort",
          () => req.destroy(new DOMException("The operation was aborted.", "AbortError")),
          { once: true },
        );
      }
    }

    req.on("error", reject);
    if (body != null) {
      req.write(typeof body === "string" ? body : Buffer.from(body as Uint8Array));
    }
    req.end();
  });
}
