# Wanspace API — `api.wanspace.biz.id`

Platform REST API gratis **tanpa API key**: 94 endpoint di 10 kategori, Next.js 14 (App Router) + TypeScript + Tailwind, serverless di Vercel.
UI/animasi mengikuti gaya portfolio Wanspace (monokrom, Poppins, Lenis smooth scroll, Framer Motion).

## Fitur
- **REST API** `GET /api/{category}/{endpoint}` — JSON seragam (`status`, `code`, `result`, `meta`), gambar/SVG untuk endpoint tertentu
- **Playground terminal** (`/playground`): `help`, `ls`, `info`, `get`, `curl`, `status`, riwayat ↑↓, Tab-autocomplete, preview gambar
- **Docs** (`/docs`): cari, filter kategori, parameter, contoh cURL/fetch, "Try in playground"
- **Status real-time** (`/status`): health check tiap endpoint via Server-Sent Events (fallback polling otomatis)
- **Command palette** `Ctrl/⌘ + K`
- **Keamanan**: rate limit per IP (burst 10s + per menit, berbobot per endpoint), auto-block pelanggar, filter scanner/probe path, anti-SSRF, validasi parameter ketat, hanya GET, error disanitasi (URL upstream/stack trace tidak bocor), IP di-hash, CSP + HSTS + header keamanan lain, CORS bisa dibatasi

## Struktur
```
src/
  config/        site.ts, categories.ts
  lib/
    endpoints/   ← SEMUA endpoint, satu file per kategori (ai, anime, news, tools, ...)
    api/         registry, validate, http (fetch aman + anti-SSRF), execute, guard, health, response
    security/    store (Redis/memory), limiter, rules, client-id
  app/
    api/         route dinamis + status, stream (SSE), endpoints, health
    docs/ playground/ status/ + page.tsx (landing)
  components/    UI + sections/
  middleware.ts  filter scanner, probe path, method gate
scripts/         selftest.ts, routetest.ts, verify-endpoints.mjs
```

## Menambah endpoint (cukup 1 blok)
Buka file kategori di `src/lib/endpoints/*.ts`, tambahkan ke array `group(...)`:
```ts
{
  slug: "contoh",
  title: "Contoh",
  description: "Deskripsi singkat.",
  params: [{ name: "q", required: true, max: 100, description: "Kata kunci.", example: "halo" }],
  cache: 300,          // detik, cache CDN
  cost: 1,             // bobot rate limit
  run: async (ctx) => ctx.first([               // sumber utama → fallback
    async () => (await ctx.json(`https://api.example.com?q=${enc(ctx.q.q as string)}`)),
    async () => (await ctx.json(`https://backup.example.com?q=${enc(ctx.q.q as string)}`)),
  ]),
}
```
Otomatis muncul di docs, playground, command palette, katalog `/api/endpoints`, dan halaman status. Jalankan `npm run selftest` untuk validasi.

## Menjalankan
```bash
npm install
cp .env.example .env.local      # isi sesuai kebutuhan
npm run dev                     # http://localhost:3000
npm run selftest                # uji lokal tanpa internet (registry, SSRF, limiter, route handler)
npm run typecheck && npm run build
```

## Deploy ke Vercel + domain
1. Push ke GitHub → **Import** di Vercel (framework terdeteksi otomatis).
2. **Wajib untuk production:** tambahkan Redis (Vercel Marketplace → *Upstash Redis*, gratis) lalu pastikan env `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (atau `KV_REST_API_*`) terisi. Tanpa Redis, rate limit hanya per-instance serverless (lemah) dan metrik/riwayat status tidak global.
3. Isi `IP_HASH_SALT` (string acak), `NEXT_PUBLIC_SITE_URL=https://api.wanspace.biz.id`.
4. *Settings → Domains* → tambahkan `api.wanspace.biz.id`, lalu buat record **CNAME** `api` → `cname.vercel-dns.com` di DNS `wanspace.biz.id`.
5. Setelah live: `npm run verify -- https://api.wanspace.biz.id` untuk menguji **semua** endpoint dengan sumber aslinya.

`vercel.json` menempatkan fungsi di `sin1` (Singapura) agar dekat dengan pengguna Indonesia dan sumber data lokal (BMKG, portal berita).

## Catatan jujur
- Semua data berasal dari **API/RSS publik pihak ketiga tanpa key**. Sumber gratis bisa berubah, lambat, atau membatasi trafik. Karena itu ada *fallback* di endpoint penting dan halaman **Status** yang memonitor tiap endpoint. Endpoint AI gratis (`ai/chat`) adalah yang paling mungkin tidak stabil.
- Endpoint berkuota ketat (Jikan, GitHub, CoinGecko, trace.moe) di-cache lebih lama; probe status untuknya memakai cache agar tidak menghabiskan kuota.
- Anti-SSRF memeriksa DNS sebelum fetch; celah teoritis DNS-rebinding (TOCTOU) tidak bisa ditutup penuh dengan `fetch` standar — endpoint yang menerima URL (`linkpreview`, `unshorten`, `website-status`) diberi bobot rate-limit lebih tinggi.
- Tidak ada downloader video (TikTok/YouTube) karena melanggar ToS/hak cipta dan sangat rapuh.
- Hanya konten SFW (anime image, meme, random anime disaring).
