import { endpoints, exampleQuery } from "./registry";
import { execute } from "./execute";
import { isBinary, type EndpointDef } from "./types";
import { parseParams } from "./validate";
import { hasRedis, kvGetJson, kvSetJson, pipeline } from "../security/store";

export type State = "operational" | "degraded" | "down";
export interface ProbeResult {
  id: string;
  category: string;
  title: string;
  state: State;
  latency: number | null;
  note?: string;
}
export interface Snapshot {
  checkedAt: string;
  summary: { operational: number; degraded: number; down: number; total: number; avgLatency: number };
  overall: State;
  endpoints: ProbeResult[];
}
export interface HistoryPoint {
  t: number;
  ok: number;
  deg: number;
  down: number;
  avg: number;
}

const TTL_MS = 60_000;
const SLOW_MS = 4000;
const CONCURRENCY = 8;
const g = globalThis as unknown as { __wsSnap?: Snapshot; __wsFlight?: Promise<Snapshot>; __wsHist?: HistoryPoint[] };

async function probe(def: EndpointDef): Promise<ProbeResult> {
  const base = { id: def.id, category: def.category, title: def.title };
  const started = Date.now();
  try {
    const q = parseParams(def.params, new URLSearchParams(exampleQuery(def.params)));
    const { data, usedFallback } = await execute(def, q, { clientIp: "8.8.8.8", fresh: !def.quota, timeoutMs: 12_000 });
    const latency = Date.now() - started;
    const empty = data == null || (Array.isArray(data) && data.length === 0) || (isBinary(data) && data.body.byteLength === 0);
    if (empty) return { ...base, state: "degraded", latency, note: "empty result" };
    if (usedFallback) return { ...base, state: "degraded", latency, note: "using fallback source" };
    if (latency > SLOW_MS) return { ...base, state: "degraded", latency, note: "slow response" };
    return { ...base, state: "operational", latency };
  } catch {
    return { ...base, state: "down", latency: null, note: "unavailable" };
  }
}

async function runAll(): Promise<Snapshot> {
  const results: ProbeResult[] = new Array(endpoints.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= endpoints.length) return;
      results[i] = await probe(endpoints[i]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = results.filter((r) => r.state === "operational").length;
  const deg = results.filter((r) => r.state === "degraded").length;
  const down = results.filter((r) => r.state === "down").length;
  const lat = results.map((r) => r.latency).filter((x): x is number => typeof x === "number");
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  const overall: State = down / results.length > 0.25 ? "down" : down + deg > 0 ? "degraded" : "operational";

  const snap: Snapshot = { checkedAt: new Date().toISOString(), summary: { operational: ok, degraded: deg, down, total: results.length, avgLatency: avg }, overall, endpoints: results };
  g.__wsSnap = snap;
  await kvSetJson("st:snap", snap, 300);
  await pushHistory({ t: Date.now(), ok, deg, down, avg });
  return snap;
}

async function pushHistory(p: HistoryPoint) {
  if (hasRedis) await pipeline([["LPUSH", "st:hist", JSON.stringify(p)], ["LTRIM", "st:hist", 0, 287]]);
  const arr = (g.__wsHist ??= []);
  arr.unshift(p);
  arr.length = Math.min(arr.length, 288);
}

export async function getHistory(n = 60): Promise<HistoryPoint[]> {
  let list: HistoryPoint[] = g.__wsHist ?? [];
  if (hasRedis) {
    const r = await pipeline([["LRANGE", "st:hist", 0, n - 1]]);
    const raw = r?.[0];
    if (Array.isArray(raw)) {
      list = raw.map((x) => { try { return JSON.parse(String(x)) as HistoryPoint; } catch { return null; } }).filter((x): x is HistoryPoint => x !== null);
    }
  }
  return list.slice(0, n).reverse();
}

/** Snapshot status; dihitung ulang maksimal 1x/menit (single-flight, dibagi lewat Redis bila ada). */
export async function getSnapshot(opts: { wait?: boolean } = { wait: true }): Promise<Snapshot | null> {
  const fresh = (s?: Snapshot | null) => (s && Date.now() - Date.parse(s.checkedAt) < TTL_MS ? s : null);
  const mem = fresh(g.__wsSnap);
  if (mem) return mem;
  const shared = fresh(await kvGetJson<Snapshot>("st:snap"));
  if (shared) {
    g.__wsSnap = shared;
    return shared;
  }
  const flight = (g.__wsFlight ??= runAll().finally(() => { g.__wsFlight = undefined; }));
  if (opts.wait === false) {
    flight.catch(() => {});
    return g.__wsSnap ?? (await kvGetJson<Snapshot>("st:snap"));
  }
  return flight;
}
