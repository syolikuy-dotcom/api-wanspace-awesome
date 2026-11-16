/* Jalankan: npm run selftest  — tidak butuh jaringan. */
import assert from "node:assert/strict";
import { endpoints, exampleQuery, getCatalog } from "../src/lib/api/registry";
import { parseParams } from "../src/lib/api/validate";
import { createCtx, isPrivateIp, assertPublicUrl } from "../src/lib/api/http";
import { parseFeed } from "../src/lib/api/xml";
import { isBinary } from "../src/lib/api/types";
import { hit, LIMITS } from "../src/lib/security/limiter";
import { inspect } from "../src/lib/security/rules";
import { CATEGORY_IDS } from "../src/config/categories";

let pass = 0;
const t = async (name: string, fn: () => unknown | Promise<unknown>) => {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const run = async (id: string, query: Record<string, string> = {}) => {
  const def = endpoints.find((e) => e.id === id)!;
  const q = parseParams(def.params, new URLSearchParams({ ...exampleQuery(def.params), ...query }));
  const ctx = createCtx(def, q, { clientIp: "8.8.8.8", fresh: true });
  return def.run(ctx) as Promise<any>;
};

(async () => {
  console.log(`\nRegistry (${endpoints.length} endpoints)`);
  await t("id unik & kategori valid", () => {
    const ids = new Set<string>();
    for (const e of endpoints) {
      assert.ok(!ids.has(e.id), `duplikat ${e.id}`);
      ids.add(e.id);
      assert.ok((CATEGORY_IDS as readonly string[]).includes(e.category), `kategori ${e.id}`);
      assert.match(e.slug, /^[a-z0-9-]+$/, `slug ${e.id}`);
    }
  });
  await t("semua param wajib punya contoh yang lolos validasi", () => {
    for (const e of endpoints) {
      const q = new URLSearchParams(exampleQuery(e.params));
      assert.doesNotThrow(() => parseParams(e.params, q), `contoh gagal: ${e.id}`);
    }
  });
  await t("nilai default & contoh enum valid", () => {
    for (const e of endpoints)
      for (const p of e.params) {
        if (p.type === "enum") {
          assert.ok(p.values?.length, `${e.id}.${p.name} tanpa values`);
          if (p.default !== undefined) assert.ok(p.values!.includes(String(p.default)), `${e.id}.${p.name} default`);
          if (p.example !== undefined) assert.ok(p.values!.includes(String(p.example)), `${e.id}.${p.name} contoh`);
        }
      }
  });
  await t("katalog bisa di-serialisasi JSON", () => assert.doesNotThrow(() => JSON.stringify(getCatalog())));
  await t("setiap kategori punya endpoint", () => {
    for (const c of CATEGORY_IDS) assert.ok(endpoints.some((e) => e.category === c), c);
  });

  console.log("\nValidasi parameter");
  const a = endpoints.find((e) => e.id === "tools/hash")!;
  await t("wajib diisi", () => assert.throws(() => parseParams(a.params, new URLSearchParams()), /required/));
  await t("enum ditolak", () => assert.throws(() => parseParams(a.params, new URLSearchParams("text=x&algo=nope")), /one of/));
  await t("panjang maksimum", () => assert.throws(() => parseParams(a.params, new URLSearchParams({ text: "x".repeat(3001) })), /at most/));
  await t("karakter kontrol dibuang", () => assert.equal(parseParams(a.params, new URLSearchParams({ text: "a\u0000b" })).text, "ab"));

  console.log("\nAnti-SSRF");
  for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "100.64.0.1"])
    await t(`blok ${ip}`, () => assert.equal(isPrivateIp(ip), true));
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) await t(`izinkan ${ip}`, () => assert.equal(isPrivateIp(ip), false));
  for (const u of ["http://localhost/", "http://127.0.0.1:80/", "http://[::1]/", "http://2130706433/", "http://foo.internal/", "http://intranet/", "http://example.com:22/", "ftp://example.com/", "http://user:pw@example.com/"])
    await t(`tolak ${u}`, async () => assert.rejects(() => assertPublicUrl(u)));

  console.log("\nEndpoint lokal");
  await t("tools/hash sha256", async () => assert.equal((await run("tools/hash", { text: "abc" })).hex, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  await t("tools/encode base64 roundtrip", async () => {
    const e = await run("tools/encode", { text: "Halo Dunia ✓", type: "base64" });
    assert.equal((await run("tools/encode", { text: e.output, type: "base64", mode: "decode" })).output, "Halo Dunia ✓");
  });
  await t("tools/encode binary/hex/url/html", async () => {
    for (const type of ["binary", "hex", "url", "html", "base64url"]) {
      const e = await run("tools/encode", { text: "a&b c<ü>", type });
      const d = await run("tools/encode", { text: e.output, type, mode: "decode" });
      assert.equal(d.output, "a&b c<ü>", type);
    }
  });
  await t("tools/encode input rusak → 400", async () => assert.rejects(() => run("tools/encode", { text: "zz", type: "hex", mode: "decode" }), /not valid/));
  await t("tools/uuid", async () => assert.equal((await run("tools/uuid", { count: "3" })).uuids.length, 3));
  await t("tools/time", async () => assert.match((await run("tools/time")).datetime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/));
  await t("tools/time zona salah → error", async () => assert.rejects(() => run("tools/time", { timezone: "Mars/Olympus" }), /Unknown timezone/));
  await t("tools/color", async () => {
    const c = await run("tools/color", { value: "#ff0000" });
    assert.equal(c.hsl.h, 0);
    assert.equal(c.palette.length, 5);
    assert.equal((await run("tools/color", { value: "255,0,0" })).hex, "#ff0000");
  });
  await t("tools/textutil", async () => {
    assert.equal((await run("tools/textutil", { text: "Halo Dünia API!", mode: "slug" })).result, "halo-dunia-api");
    assert.equal((await run("tools/textutil", { text: "hello big world", mode: "camel" })).result, "helloBigWorld");
    assert.equal((await run("tools/textutil", { text: "satu dua tiga", mode: "count" })).result.words, 3);
  });
  await t("tools/lorem", async () => assert.equal((await run("tools/lorem", { paragraphs: "3" })).paragraphs.length, 3));
  await t("ai/summarize", async () => {
    const r = await run("ai/summarize");
    assert.ok(r.summary.length > 0 && r.summaryLength < r.originalLength);
  });
  await t("islamic/hijri", async () => {
    const r = await run("islamic/hijri", { date: "2026-03-20" });
    assert.ok(r.hijri.year >= 1447 && r.hijri.year <= 1448, JSON.stringify(r));
  });
  await t("fun/random & 8ball", async () => {
    const r = await run("fun/random", { min: "5", max: "5" });
    assert.equal(r.result, 5);
    assert.equal((await run("fun/random", { type: "pick", items: "a,b,c" })).items.length, 3);
    assert.ok((await run("fun/8ball")).answer);
  });
  await t("ai/image tanpa jaringan", async () => assert.match((await run("ai/image")).url, /^https:\/\/image\.pollinations\.ai\/prompt\//));
  for (const id of ["maker/placeholder", "maker/badge", "maker/quote-card", "maker/gradient"])
    await t(`${id} menghasilkan SVG valid`, async () => {
      const r = await run(id);
      assert.ok(isBinary(r));
      const s = new TextDecoder().decode(r.body);
      assert.ok(s.startsWith("<svg") && s.endsWith("</svg>") && !s.includes("undefined"), s.slice(0, 80));
    });
  await t("maker/quote-card escape XSS", async () => {
    const r = await run("maker/quote-card", { text: `<script>alert(1)</script> "x" & y`, author: "<b>" });
    const s = new TextDecoder().decode(r.body);
    assert.ok(!s.includes("<script>") && !s.includes("<b>"));
  });
  await t("maker/fancy-text", async () => {
    const r = await run("maker/fancy-text", { text: "Hi 9" });
    assert.equal(r.results.bold, "𝐇𝐢 𝟗");
    assert.ok(Object.keys(r.results).length >= 8);
  });

  console.log("\nParser RSS");
  await t("RSS 2.0 + CDATA + entity", () => {
    const xml = `<rss><channel><item><title><![CDATA[Halo &amp; Dunia]]></title><link>https://x.test/a</link><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Isi &lt;img src="https://x.test/i.jpg"&gt;&lt;/p&gt;</description></item><item><title>JS</title><link>javascript:alert(1)</link></item></channel></rss>`;
    const items = parseFeed(xml, 10);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Halo & Dunia");
    assert.equal(items[0].image, "https://x.test/i.jpg");
    assert.equal(items[0].published, "2026-11-16T10:00:00.000Z");
  });
  await t("Atom", () => {
    const items = parseFeed(`<feed><entry><title>A</title><link href="https://x.test/1"/><updated>2026-01-01T00:00:00Z</updated></entry></feed>`, 5);
    assert.equal(items[0].link, "https://x.test/1");
  });

  console.log("\nAnti-abuse");
  await t("scanner UA & probe path diblokir", () => {
    assert.equal(inspect("/", "", "sqlmap/1.7", "GET").ok, false);
    assert.equal(inspect("/.env", "", "curl", "GET").ok, false);
    assert.equal(inspect("/wp-admin/x", "", "curl", "GET").ok, false);
    assert.equal(inspect("/api/admin", "", "curl", "GET").ok, false);
    assert.equal(inspect("/api/ai/chat", "?a=../../etc/passwd", "curl", "GET").ok, false);
    assert.equal(inspect("/api/ai/chat", "", "curl/8", "POST").ok, false);
    assert.equal(inspect("/api/ai/chat", "?text=hi", "Mozilla/5.0", "GET").ok, true);
    assert.equal(inspect("/docs", "", "Mozilla/5.0", "GET").ok, true);
  });
  await t("rate limit: burst → 429 → auto-block", async () => {
    const id = `test-${Math.random()}`;
    let allowed = 0;
    let first429 = -1;
    let blocked = false;
    for (let i = 0; i < 60; i++) {
      const r = await hit(id, 1);
      if (r.allowed) allowed++;
      else if (first429 < 0) first429 = i;
      if (r.blocked) blocked = true;
    }
    assert.equal(allowed, LIMITS.burst10s);
    assert.equal(first429, LIMITS.burst10s);
    assert.ok(blocked, "harus terblokir setelah strike berulang");
    const after = await hit(id, 1);
    assert.equal(after.blocked, true);
    assert.ok(after.retryAfterSec > 0);
  });
  await t("IP berbeda tidak saling terpengaruh", async () => assert.equal((await hit(`other-${Math.random()}`, 1)).allowed, true));
  await t("cost berat menghabiskan kuota lebih cepat", async () => {
    const id = `cost-${Math.random()}`;
    const r = await hit(id, 4);
    assert.equal(r.remaining, LIMITS.perMin - 4);
  });

  console.log(`\n${process.exitCode ? "GAGAL" : "OK"} — ${pass} lulus\n`);
})();
