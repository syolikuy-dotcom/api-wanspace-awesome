/** Mengambil IP klien dan mengubahnya menjadi ID anonim (hash) untuk kunci rate-limit. */

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;

export function getClientIp(headers: Headers): string {
  // Di Vercel, header ini diisi oleh platform (tidak bisa dipalsukan klien).
  const raw =
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0] ||
    "";
  const ip = raw.trim();
  return IP_RE.test(ip) ? ip : "0.0.0.0";
}

const SALT = process.env.IP_HASH_SALT || "wanspace-default-salt";

export async function hashId(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 8; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex; // 64-bit cukup untuk kunci limiter, tidak bisa dibalik ke IP
}

const blocked = new Set(
  (process.env.BLOCKED_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export const isStaticBlocked = (ip: string) => blocked.has(ip);
