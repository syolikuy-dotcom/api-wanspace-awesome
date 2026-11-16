import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ApiError, UpstreamError } from "./errors";
import type { Ctx, EndpointDef, FetchInit, PublicResponse, Q } from "./types";

export const UA = "Mozilla/5.0 (compatible; WanspaceAPI/1.0; +https://api.wanspace.biz.id)";
const DEFAULT_TIMEOUT = 8000;
const DEFAULT_MAX_BYTES = 2_000_000;

/* ───────── helper SSRF ───────── */

function privateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ipRaw: string): boolean {
  const ip = ipRaw.toLowerCase().replace(/^\[|\]$/g, "");
  const kind = isIP(ip);
  if (kind === 4) return privateV4(ip);
  if (kind !== 6) return true;

  if (ip === "::" || ip === "::1") return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || ip.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  const hexMapped = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return privateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const first = ip.split(":")[0];
  if (/^f[cd]/.test(first)) return true; // fc00::/7 (ULA)
  if (/^fe[89ab]/.test(first)) return true; // fe80::/10 (link-local)
  if (/^ff/.test(first)) return true; // multicast
  if (ip.startsWith("2001:db8")) return true; // dokumentasi
  return false;
}

const BAD_HOST_SUFFIX = /\.(localhost|local|internal|lan|home|corp|intranet|localdomain|home\.arpa)$/;

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ApiError(400, "invalid_url", "Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new ApiError(400, "invalid_url", "Only http(s) URLs are allowed.");
  if (u.username || u.password) throw new ApiError(400, "invalid_url", "URLs with credentials are not allowed.");
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  if (![80, 443, 8080, 8443].includes(port)) throw new ApiError(400, "blocked_target", "This port is not allowed.");

  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const literal = isIP(host) !== 0;
  if (host === "localhost" || BAD_HOST_SUFFIX.test(host) || (!literal && !host.includes("."))) {
    throw new ApiError(400, "blocked_target", "This address is not allowed.");
  }
  if (literal) {
    if (isPrivateIp(host)) throw new ApiError(400, "blocked_target", "This address is not allowed.");
  } else {
    let addrs: { address: string }[];
    try {
      addrs = await lookup(host, { all: true });
    } catch {
      throw new ApiError(400, "unresolvable_host", "The host could not be resolved.");
    }
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
      throw new ApiError(400, "blocked_target", "This address is not allowed.");
    }
  }
  return u;
}

/* ───────── fetch inti ───────── */

async function readLimited(res: Response, maxBytes: number, truncate = false): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (!truncate && Number.isFinite(declared) && declared > maxBytes) throw new UpstreamError("response too large");
  if (!res.body) return new Uint8Array(await res.arrayBuffer());

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      if (!truncate) throw new UpstreamError("response too large");
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
      total = maxBytes;
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

interface CoreOpts {
  fresh: boolean;
  ttl: number;
  redirect?: RequestRedirect;
}

async function core(url: string, init: FetchInit, o: CoreOpts) {
  const ctrl = new AbortController();
  const timeout = init.timeout ?? DEFAULT_TIMEOUT;
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const ttl = init.ttl ?? o.ttl;

  const opts: RequestInit & { next?: { revalidate: number } } = {
    method: init.method ?? "GET",
    headers: { "User-Agent": UA, Accept: "*/*", ...init.headers },
    body: init.body,
    redirect: o.redirect ?? "follow",
    signal: ctrl.signal,
  };
  if (o.fresh || ttl <= 0 || (init.method && init.method !== "GET")) opts.cache = "no-store";
  else opts.next = { revalidate: ttl };

  const started = Date.now();
  try {
    const res = await fetch(url, opts);
    const body = init.method === "HEAD" ? new Uint8Array() : await readLimited(res, init.maxBytes ?? DEFAULT_MAX_BYTES, init.truncate);
    return { res, body, ms: Date.now() - started };
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    const aborted = ctrl.signal.aborted || (e instanceof Error && e.name === "AbortError");
    throw new UpstreamError(aborted ? "timeout" : "network error", 0, aborted);
  } finally {
    clearTimeout(timer);
  }
}

const decode = (b: Uint8Array) => new TextDecoder("utf-8").decode(b);

export function createCtx(def: EndpointDef, q: Q, opts: { clientIp: string; fresh: boolean }): Ctx {
  const ttl = typeof def.cache === "function" ? def.cache(q) : def.cache;
  const base: CoreOpts = { fresh: opts.fresh, ttl };

  const ctx: Ctx = {
    q,
    clientIp: opts.clientIp,
    usedFallback: false,

    async json<T>(url: string, init: FetchInit = {}) {
      const { res, body } = await core(url, { ...init, headers: { Accept: "application/json", ...init.headers } }, base);
      if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`, res.status);
      try {
        return JSON.parse(decode(body)) as T;
      } catch {
        throw new UpstreamError("invalid json");
      }
    },

    async text(url: string, init: FetchInit = {}) {
      const { res, body } = await core(url, init, base);
      if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`, res.status);
      return decode(body);
    },

    async bin(url: string, init: FetchInit = {}) {
      const { res, body } = await core(url, { maxBytes: 5_000_000, ...init }, base);
      if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`, res.status);
      if (body.byteLength === 0) throw new UpstreamError("empty body");
      return { body, contentType: res.headers.get("content-type") || "application/octet-stream" };
    },

    async publicFetch(url: string, init: FetchInit & { method?: "GET" | "HEAD" } = {}): Promise<PublicResponse> {
      let current = url;
      const redirects: string[] = [];
      for (let hop = 0; hop <= 4; hop++) {
        const target = await assertPublicUrl(current);
        const { res, body, ms } = await core(target.toString(), { maxBytes: 1_500_000, truncate: true, ...init }, { ...base, fresh: true, redirect: "manual" });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) return { status: res.status, finalUrl: target.toString(), headers: res.headers, text: "", ms, redirects };
          if (hop === 4) throw new ApiError(400, "too_many_redirects", "Too many redirects.");
          current = new URL(loc, target).toString();
          redirects.push(current);
          continue;
        }
        return { status: res.status, finalUrl: target.toString(), headers: res.headers, text: decode(body), ms, redirects };
      }
      throw new ApiError(400, "too_many_redirects", "Too many redirects.");
    },

    async first<T>(sources: (() => Promise<T>)[]): Promise<T> {
      let last: unknown = new UpstreamError("no source");
      for (let i = 0; i < sources.length; i++) {
        try {
          const v = await sources[i]();
          if (i > 0) ctx.usedFallback = true;
          return v;
        } catch (e) {
          if (e instanceof ApiError) throw e;
          last = e;
        }
      }
      throw last;
    },
  };
  return ctx;
}
