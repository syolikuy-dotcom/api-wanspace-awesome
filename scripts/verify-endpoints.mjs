#!/usr/bin/env node
/**
 * Uji SEMUA endpoint pada deployment nyata (butuh internet).
 *   node scripts/verify-endpoints.mjs https://api.wanspace.biz.id
 *   node scripts/verify-endpoints.mjs http://localhost:3000
 * Memakai jeda & retry agar tidak terkena rate limit milik sendiri. Exit code 1 jika ada yang gagal.
 */
const base = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "WanspaceVerify/1.0";

async function hit(path, tries = 2) {
  for (let i = 0; i < tries; i++) {
    const t = Date.now();
    try {
      const res = await fetch(base + path, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40000) });
      const ms = Date.now() - t;
      const ct = res.headers.get("content-type") || "";
      if (res.status === 429) {
        await sleep((Number(res.headers.get("retry-after")) || 10) * 1000 + 300);
        continue;
      }
      if (/json/.test(ct)) {
        const j = await res.json();
        return { ok: res.ok && j.status === true, code: res.status, ms, note: j.status ? "" : j.error?.message ?? "error" };
      }
      const buf = await res.arrayBuffer();
      return { ok: res.ok && buf.byteLength > 0, code: res.status, ms, note: `${ct.split(";")[0]} ${buf.byteLength}B` };
    } catch (e) {
      if (i === tries - 1) return { ok: false, code: 0, ms: Date.now() - t, note: String(e.message || e) };
    }
  }
  return { ok: false, code: 429, ms: 0, note: "rate limited" };
}

const cat = await (await fetch(`${base}/api/endpoints`, { headers: { "User-Agent": UA } })).json();
if (!cat.result) throw new Error("Tidak bisa membaca /api/endpoints");
console.log(`\nMenguji ${cat.total} endpoint di ${base}\n`);

let fail = 0;
for (const e of cat.result) {
  const r = await hit(e.example);
  if (!r.ok) fail++;
  console.log(`${r.ok ? "✓" : "✗"} ${e.id.padEnd(28)} ${String(r.code).padEnd(4)} ${String(r.ms).padStart(5)}ms  ${r.note}`);
  await sleep(1100);
}
console.log(`\n${cat.total - fail}/${cat.total} OK${fail ? ` — ${fail} gagal (cek sumber upstream-nya)` : ""}\n`);
process.exit(fail ? 1 : 0);
