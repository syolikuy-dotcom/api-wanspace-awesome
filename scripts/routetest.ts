import assert from "node:assert/strict";
import { GET as api, POST } from "../src/app/api/[category]/[endpoint]/route";
import { GET as cat } from "../src/app/api/[category]/route";
import { GET as index } from "../src/app/api/route";
import { GET as catalog } from "../src/app/api/endpoints/route";

const call = (path: string, ip = "203.0.113.7", h: Record<string, string> = {}) =>
  api(new Request(`https://api.wanspace.biz.id${path}`, { headers: { "x-vercel-forwarded-for": ip, ...h } }), { params: { category: path.split("/")[2], endpoint: path.split("/")[3].split("?")[0] } });

(async () => {
  let r = await call("/api/tools/hash?text=abc");
  let j: any = await r.json();
  assert.equal(r.status, 200); assert.equal(j.status, true); assert.equal(j.result.algo, "sha256");
  assert.equal(r.headers.get("x-ratelimit-limit"), "60");
  assert.match(r.headers.get("cache-control")!, /s-maxage=86400/);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  console.log("✓ 200 JSON + header keamanan/cache/rate");

  r = await call("/api/tools/hash"); j = await r.json();
  assert.equal(r.status, 400); assert.equal(j.error.type, "missing_parameter"); assert.equal(r.headers.get("cache-control"), "no-store");
  console.log("✓ 400 parameter wajib");

  r = await call("/api/tools/nope"); j = await r.json();
  assert.equal(r.status, 404); assert.ok(j.error.available.includes("hash"));
  console.log("✓ 404 + saran endpoint");

  r = await call("/api/maker/badge?label=api&message=ok");
  assert.equal(r.status, 200); assert.match(r.headers.get("content-type")!, /svg/);
  assert.match(await r.text(), /^<svg/);
  console.log("✓ SVG biner + content-type");

  r = await call("/api/tools/ip?ip=127.0.0.1"); j = await r.json();
  assert.equal(r.status, 400);
  r = await call("/api/tools/linkpreview?url=http://169.254.169.254/latest/meta-data"); j = await r.json();
  assert.equal(r.status, 400); assert.equal(j.error.type, "blocked_target");
  assert.ok(!JSON.stringify(j).includes("169.254"));
  console.log("✓ SSRF diblokir (metadata cloud) tanpa membocorkan target");

  r = await call("/api/tools/encode?text=%E0%A4%A&type=url&mode=decode"); j = await r.json();
  assert.equal(r.status, 400);
  console.log("✓ input rusak → 400 bersih");

  const p = await POST(new Request("https://x/api/ai/chat", { method: "POST" }));
  assert.equal(p.status, 405); assert.equal(p.headers.get("allow"), "GET, HEAD, OPTIONS");
  console.log("✓ POST → 405");

  // rate limit + auto block
  const ip = "198.51.100.9"; const codes: number[] = [];
  for (let i = 0; i < 40; i++) codes.push((await call("/api/tools/uuid", ip)).status);
  assert.equal(codes.filter((c) => c === 200).length, 15);
  assert.ok(codes.includes(429)); assert.ok(codes.includes(403));
  const blocked = await call("/api/tools/uuid", ip); const bj: any = await blocked.json();
  assert.equal(blocked.status, 403); assert.ok(Number(blocked.headers.get("retry-after")) > 0); assert.equal(bj.error.type, "temporarily_blocked");
  console.log("✓ burst 15 → 429 → auto-block 403 + Retry-After");
  assert.equal((await call("/api/tools/uuid", "192.0.2.1")).status, 200);
  console.log("✓ IP lain tidak terdampak");

  const ic = await (await index(new Request("https://x/api"))).json() as any;
  assert.equal(ic.categories.length, 10);
  const cc = await (await cat(new Request("https://x/api/ai"), { params: { category: "ai" } })).json() as any;
  assert.equal(cc.result.length, 5);
  const ct = await (await catalog(new Request("https://x/api/endpoints"))).json() as any;
  assert.ok(ct.total >= 90);
  console.log(`✓ index / kategori / katalog (${ct.total} endpoint, ${ic.categories.length} kategori)`);
  console.log("\nSEMUA OK");
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
