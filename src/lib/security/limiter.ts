import { hasRedis, memory, pipeline } from "./store";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const LIMITS = {
  perMin: num(process.env.RATE_LIMIT_PER_MIN, 60),
  burst10s: num(process.env.RATE_LIMIT_BURST_10S, 15),
  strikes: num(process.env.AUTO_BLOCK_STRIKES, 5),
  blockSeconds: num(process.env.AUTO_BLOCK_SECONDS, 900),
  strikeWindow: 600,
} as const;

export type HitResult = {
  allowed: boolean;
  blocked: boolean;
  limit: number;
  remaining: number;
  /** detik sampai jendela 60s reset */
  resetSec: number;
  /** detik yang harus ditunggu klien (hanya saat ditolak) */
  retryAfterSec: number;
  store: "redis" | "memory";
};

const now = () => Date.now();

function result(p: Partial<HitResult> & { store: HitResult["store"] }): HitResult {
  return {
    allowed: true,
    blocked: false,
    limit: LIMITS.perMin,
    remaining: LIMITS.perMin,
    resetSec: 60,
    retryAfterSec: 0,
    ...p,
  };
}

/** Catat satu request (dengan bobot `cost`) dan putuskan boleh/tidak. */
export async function hit(id: string, cost = 1): Promise<HitResult> {
  const t = now();
  const b10 = Math.floor(t / 10_000);
  const b60 = Math.floor(t / 60_000);
  const resetSec = Math.max(1, Math.ceil(((b60 + 1) * 60_000 - t) / 1000));
  const k10 = `rl:10:${id}:${b10}`;
  const k60 = `rl:60:${id}:${b60}`;
  const kBlk = `blk:${id}`;
  const kMin = `m:min:${b60}`;

  let c10: number;
  let c60: number;
  let blockedMs = 0;
  let store: HitResult["store"] = "memory";

  const r = hasRedis
    ? await pipeline([
        ["INCRBY", k10, cost],
        ["EXPIRE", k10, 20],
        ["INCRBY", k60, cost],
        ["EXPIRE", k60, 120],
        ["PTTL", kBlk],
        ["INCR", "m:total"],
        ["INCR", kMin],
        ["EXPIRE", kMin, 7200],
      ])
    : null;

  if (r) {
    store = "redis";
    c10 = Number(r[0]) || cost;
    c60 = Number(r[2]) || cost;
    const pttl = Number(r[4]);
    blockedMs = Number.isFinite(pttl) && pttl > 0 ? pttl : 0;
  } else {
    c10 = memory.incrby(k10, cost, 20);
    c60 = memory.incrby(k60, cost, 120);
    memory.incrby("m:total", 1, 31_536_000);
    memory.incrby(kMin, 1, 7200);
    blockedMs = memory.get(kBlk) ? memory.ttlMs(kBlk) : 0;
  }

  if (blockedMs > 0) {
    return result({
      allowed: false,
      blocked: true,
      remaining: 0,
      resetSec,
      retryAfterSec: Math.ceil(blockedMs / 1000),
      store,
    });
  }

  if (c10 > LIMITS.burst10s || c60 > LIMITS.perMin) {
    const strikes = await addStrike(id, store);
    const retry = c10 > LIMITS.burst10s && c60 <= LIMITS.perMin ? 10 : resetSec;
    return result({
      allowed: false,
      blocked: strikes >= LIMITS.strikes,
      remaining: 0,
      resetSec,
      retryAfterSec: strikes >= LIMITS.strikes ? LIMITS.blockSeconds : retry,
      store,
    });
  }

  return result({ remaining: Math.max(0, LIMITS.perMin - c60), resetSec, store });
}

/** Tambah "strike". Jika melebihi ambang → blokir IP sementara. Mengembalikan jumlah strike. */
export async function addStrike(id: string, store: "redis" | "memory" = hasRedis ? "redis" : "memory"): Promise<number> {
  const kSt = `st:${id}`;
  let strikes: number;
  if (store === "redis") {
    const r = await pipeline([
      ["INCR", kSt],
      ["EXPIRE", kSt, LIMITS.strikeWindow],
    ]);
    strikes = r ? Number(r[0]) || 1 : memory.incrby(kSt, 1, LIMITS.strikeWindow);
    if (strikes >= LIMITS.strikes) await pipeline([["SET", `blk:${id}`, "1", "EX", LIMITS.blockSeconds]]);
    if (!r) memory.set(`blk:${id}`, 1, LIMITS.blockSeconds);
  } else {
    strikes = memory.incrby(kSt, 1, LIMITS.strikeWindow);
    if (strikes >= LIMITS.strikes) memory.set(`blk:${id}`, 1, LIMITS.blockSeconds);
  }
  return strikes;
}

/** Blokir langsung (dipakai untuk probe path berbahaya yang berulang). */
export async function blockNow(id: string, seconds = LIMITS.blockSeconds) {
  if (hasRedis) await pipeline([["SET", `blk:${id}`, "1", "EX", seconds]]);
  else memory.set(`blk:${id}`, 1, seconds);
}

/* ───────── Metrik ringan ───────── */

export type Metrics = { total: number; lastMinute: number; series: number[]; store: "redis" | "memory" };

export async function readMetrics(minutes = 30): Promise<Metrics> {
  const b60 = Math.floor(now() / 60_000);
  const keys: string[] = [];
  for (let i = minutes - 1; i >= 0; i--) keys.push(`m:min:${b60 - i}`);

  if (hasRedis) {
    const r = await pipeline([["GET", "m:total"], ["MGET", ...keys]]);
    if (r) {
      const arr = Array.isArray(r[1]) ? (r[1] as unknown[]) : [];
      const series = keys.map((_, i) => Number(arr[i]) || 0);
      return { total: Number(r[0]) || 0, lastMinute: series[series.length - 1] ?? 0, series, store: "redis" };
    }
  }
  const series = keys.map((k) => Number(memory.get(k)) || 0);
  return { total: Number(memory.get("m:total")) || 0, lastMinute: series[series.length - 1] ?? 0, series, store: "memory" };
}
