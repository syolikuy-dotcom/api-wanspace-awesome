import type { HitResult } from "../security/limiter";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

export function newRequestId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function baseHeaders(req: Request, requestId: string): Headers {
  const h = new Headers();
  const origin = req.headers.get("origin");
  if (CORS_ORIGINS.length === 0) h.set("Access-Control-Allow-Origin", "*");
  else {
    h.set("Vary", "Origin");
    if (origin && CORS_ORIGINS.includes(origin)) h.set("Access-Control-Allow-Origin", origin);
  }
  h.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Access-Control-Expose-Headers", "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After");
  h.set("X-Request-Id", requestId);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Cross-Origin-Resource-Policy", "cross-origin");
  h.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  h.set("Referrer-Policy", "no-referrer");
  return h;
}

export function rateHeaders(h: Headers, r: HitResult) {
  h.set("X-RateLimit-Limit", String(r.limit));
  h.set("X-RateLimit-Remaining", String(r.remaining));
  h.set("X-RateLimit-Reset", String(r.resetSec));
  if (!r.allowed) h.set("Retry-After", String(r.retryAfterSec));
}

export function cacheHeader(h: Headers, ttl: number) {
  h.set("Cache-Control", ttl > 0 ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl * 2, 86400)}` : "no-store");
}

export function jsonResponse(req: Request, body: unknown, status: number, h: Headers): Response {
  h.set("Content-Type", "application/json; charset=utf-8");
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-store");
  const text = JSON.stringify(body, null, 2);
  return new Response(req.method === "HEAD" ? null : text, { status, headers: h });
}

export function errorBody(status: number, type: string, message: string, requestId: string, extra: Record<string, unknown> = {}) {
  return { status: false, code: status, error: { type, message, ...extra }, meta: { requestId, timestamp: new Date().toISOString() } };
}

export function okBody(category: string, endpoint: string, result: unknown, latency: number, requestId: string) {
  return { status: true, code: 200, category, endpoint, result, meta: { latency, requestId, timestamp: new Date().toISOString() } };
}
