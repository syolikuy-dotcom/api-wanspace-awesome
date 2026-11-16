import { getClientIp, hashId } from "../security/client-id";
import { hit, type HitResult } from "../security/limiter";
import { baseHeaders, cacheHeader, errorBody, jsonResponse, newRequestId, rateHeaders } from "./response";

export interface Guarded {
  req: Request;
  requestId: string;
  ip: string;
  id: string;
  headers: Headers;
  rate: HitResult;
}

/** Jalankan pemeriksaan keamanan. Mengembalikan Response bila ditolak, atau konteks bila lolos. */
export async function guard(req: Request, cost = 1): Promise<Response | Guarded> {
  const requestId = newRequestId();
  const headers = baseHeaders(req, requestId);
  const ip = getClientIp(req.headers);
  const id = await hashId(ip);
  const rate = await hit(id, cost);
  rateHeaders(headers, rate);

  if (!rate.allowed) {
    cacheHeader(headers, 0);
    const msg = rate.blocked
      ? "Too many violations. Your access is temporarily blocked."
      : "Rate limit exceeded. Please slow down.";
    return jsonResponse(req, errorBody(rate.blocked ? 403 : 429, rate.blocked ? "temporarily_blocked" : "rate_limited", msg, requestId, { retryAfter: rate.retryAfterSec }), rate.blocked ? 403 : 429, headers);
  }
  return { req, requestId, ip, id, headers, rate };
}
