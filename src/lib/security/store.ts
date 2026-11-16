/**
 * Penyimpanan counter/blocklist/snapshot.
 *  - Jika UPSTASH_REDIS_REST_URL + TOKEN (atau KV_REST_API_*) diisi → Redis (global, dibagi semua instance).
 *  - Jika tidak → memory per-instance (cukup untuk dev; lemah di serverless production).
 * Hanya memakai fetch + Map, jadi aman dipakai di Edge middleware maupun Node.
 */

export type Cmd = (string | number)[];

const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/+$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export const hasRedis = Boolean(REDIS_URL && REDIS_TOKEN);

/** Jalankan beberapa perintah Redis dalam satu round-trip. Mengembalikan null bila gagal. */
export async function pipeline(cmds: Cmd[], timeoutMs = 1500): Promise<unknown[] | null> {
  if (!hasRedis || cmds.length === 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(json)) return null;
    return json.map((r) => (r && !r.error ? r.result ?? null : null));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ───────── Memory fallback ───────── */

type MemEntry = { v: number | string; exp: number };
const g = globalThis as unknown as { __wsMem?: Map<string, MemEntry>; __wsMemSweep?: number };
const mem: Map<string, MemEntry> = (g.__wsMem ??= new Map());

function sweep(now: number) {
  if (mem.size < 4000 || now - (g.__wsMemSweep ?? 0) < 30_000) return;
  g.__wsMemSweep = now;
  mem.forEach((e, k) => {
    if (e.exp <= now) mem.delete(k);
  });
  // batas keras agar memori tidak membengkak saat diserang banyak IP
  if (mem.size > 20_000) {
    let i = 0;
    mem.forEach((_, k) => {
      if (i++ < 5000) mem.delete(k);
    });
  }
}

export const memory = {
  get(key: string): number | string | null {
    const e = mem.get(key);
    if (!e) return null;
    if (e.exp <= Date.now()) {
      mem.delete(key);
      return null;
    }
    return e.v;
  },
  ttlMs(key: string): number {
    const e = mem.get(key);
    return e ? Math.max(0, e.exp - Date.now()) : 0;
  },
  incrby(key: string, n: number, ttlSec: number): number {
    const now = Date.now();
    sweep(now);
    const e = mem.get(key);
    if (!e || e.exp <= now) {
      mem.set(key, { v: n, exp: now + ttlSec * 1000 });
      return n;
    }
    e.v = Number(e.v) + n;
    return e.v as number;
  },
  set(key: string, v: number | string, ttlSec: number) {
    mem.set(key, { v, exp: Date.now() + ttlSec * 1000 });
  },
};

/* ───────── KV JSON helper (snapshot, riwayat) ───────── */

export async function kvGetJson<T>(key: string): Promise<T | null> {
  if (hasRedis) {
    const r = await pipeline([["GET", key]]);
    const raw = r?.[0];
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
  const raw = memory.get(key);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const raw = JSON.stringify(value);
  if (hasRedis) {
    await pipeline([["SET", key, raw, "EX", ttlSec]]);
    return;
  }
  memory.set(key, raw, ttlSec);
}
