import { createHash, randomUUID, randomInt } from "node:crypto";
import { isIP } from "node:net";
import { group, enc, clamp } from "../api/define";
import { ApiError, UpstreamError } from "../api/errors";
import { geocode } from "../api/geo";
import { isPrivateIp } from "../api/http";
import { binary } from "../api/types";
import { decodeEntities } from "../api/xml";

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle", 56: "Freezing drizzle", 57: "Heavy freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Heavy rain showers", 82: "Violent rain showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};
const wmo = (c: unknown) => WMO[Number(c)] ?? "Unknown";

const DOMAIN = /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9-]{2,63}$/i;
const RR: Record<number, string> = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA", 257: "CAA" };
const CRYPTO_SYM: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", dogecoin: "DOGE", ripple: "XRP", cardano: "ADA", litecoin: "LTC", tether: "USDT", binancecoin: "BNB" };

/* ───────── util lokal ───────── */

function parseColor(input: string): [number, number, number] {
  const v = input.trim().toLowerCase();
  const hex = v.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(/^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/);
  if (rgb) {
    const c = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (c.every((n) => n >= 0 && n <= 255)) return c as [number, number, number];
  }
  const hsl = v.match(/^hsl\(\s*(\d{1,3})\s*,?\s*(\d{1,3})%?\s*,?\s*(\d{1,3})%?\s*\)$/);
  if (hsl) return hslToRgb(Number(hsl[1]) % 360, clamp(Number(hsl[2]), 0, 100), clamp(Number(hsl[3]), 0, 100));
  throw new ApiError(400, "invalid_parameter", "Parameter 'value' must be a hex (#ff5733), rgb (255,87,51) or hsl(11,100%,60%) color.");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;

const META_ATTR = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
function metaTags(html: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const m of html.matchAll(/<(meta|link)\b([^>]*)>/gi)) {
    const a: Record<string, string> = { _tag: m[1].toLowerCase() };
    for (const x of m[2].matchAll(META_ATTR)) a[x[1].toLowerCase()] = decodeEntities(x[2] ?? x[3] ?? "");
    out.push(a);
  }
  return out;
}

const absUrl = (u: string | undefined, base: string): string | null => {
  if (!u) return null;
  try {
    const x = new URL(u, base);
    return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null;
  } catch {
    return null;
  }
};

const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");

export default group("tools", [
  {
    slug: "weather",
    title: "Weather",
    description: "Cuaca saat ini dan prakiraan beberapa hari untuk kota mana pun (Open-Meteo).",
    params: [
      { name: "city", required: true, max: 80, description: "Nama kota.", example: "Jakarta" },
      { name: "days", type: "number", default: 3, min: 1, max: 7, description: "Jumlah hari prakiraan.", example: 3 },
    ],
    cache: 600,
    tags: ["cuaca", "weather", "forecast"],
    run: async (ctx) => {
      const place = await geocode(ctx, ctx.q.city as string);
      const days = Math.round(Number(ctx.q.days));
      const d = await ctx.json<any>(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${days}`,
      );
      const c = d?.current;
      if (!c) throw new UpstreamError("bad shape");
      const dd = d.daily ?? {};
      return {
        location: place,
        current: {
          temperature: c.temperature_2m,
          feelsLike: c.apparent_temperature,
          humidity: c.relative_humidity_2m,
          precipitation: c.precipitation,
          windSpeed: c.wind_speed_10m,
          windDirection: c.wind_direction_10m,
          condition: wmo(c.weather_code),
          code: c.weather_code,
          time: c.time,
        },
        daily: (dd.time ?? []).map((t: string, i: number) => ({
          date: t,
          min: dd.temperature_2m_min?.[i],
          max: dd.temperature_2m_max?.[i],
          rain: dd.precipitation_sum?.[i],
          condition: wmo(dd.weather_code?.[i]),
        })),
        units: { temperature: "°C", windSpeed: "km/h", precipitation: "mm", humidity: "%" },
      };
    },
  },
  {
    slug: "time",
    title: "Time by Timezone",
    description: "Waktu sekarang di zona waktu mana pun (IANA, mis. Asia/Jakarta). Dihitung lokal.",
    params: [{ name: "timezone", default: "Asia/Jakarta", max: 60, pattern: /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/, patternHint: "IANA zone like Asia/Jakarta", description: "Zona waktu IANA.", example: "Asia/Jakarta" }],
    cache: 0,
    run: async (ctx) => {
      const tz = ctx.q.timezone as string;
      const now = new Date();
      let parts: Record<string, string>;
      let offset = "";
      try {
        const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long", timeZoneName: "longOffset" });
        parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]));
        offset = (parts.timeZoneName ?? "").replace("GMT", "") || "+00:00";
      } catch {
        throw new ApiError(400, "invalid_parameter", "Unknown timezone. Use an IANA name such as Asia/Jakarta.");
      }
      const date = `${parts.year}-${parts.month}-${parts.day}`;
      const time = `${parts.hour}:${parts.minute}:${parts.second}`;
      return { timezone: tz, date, time, datetime: `${date}T${time}${offset}`, weekday: parts.weekday, utcOffset: offset, unix: Math.floor(now.getTime() / 1000), utc: now.toISOString() };
    },
  },
  {
    slug: "qrcode",
    title: "QR Code",
    description: "Buat QR code (gambar PNG) dari teks atau URL.",
    params: [
      { name: "text", required: true, max: 500, description: "Isi QR code.", example: "https://api.wanspace.biz.id" },
      { name: "size", type: "number", default: 300, min: 100, max: 1000, description: "Ukuran sisi (px).", example: 300 },
      { name: "margin", type: "number", default: 2, min: 0, max: 10, description: "Margin (modul).", example: 2 },
    ],
    output: "image",
    cache: 86400,
    run: async (ctx) => {
      const text = enc(ctx.q.text as string);
      const size = Math.round(Number(ctx.q.size));
      const margin = Math.round(Number(ctx.q.margin));
      const img = await ctx.first([
        async () => ctx.bin(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${margin}&format=png&data=${text}`),
        async () => ctx.bin(`https://quickchart.io/qr?text=${text}&size=${size}&margin=${margin}&format=png`),
      ]);
      if (!img.contentType.startsWith("image/")) throw new UpstreamError("not an image");
      return binary(img.body, "image/png");
    },
  },
  {
    slug: "unshorten",
    title: "Unshorten URL",
    description: "Buka tautan pendek (bit.ly, dll.) dan tampilkan tujuan akhirnya beserta rantai redirect.",
    params: [{ name: "url", type: "url", required: true, description: "URL pendek.", example: "http://github.com" }],
    cache: 3600,
    cost: 2,
    run: async (ctx) => {
      const url = ctx.q.url as string;
      let r = await ctx.publicFetch(url, { method: "HEAD", timeout: 6000 }).catch(() => null);
      if (!r || r.status === 405 || r.status === 403 || r.status === 501) r = await ctx.publicFetch(url, { method: "GET", maxBytes: 100_000, timeout: 8000 });
      return { input: url, finalUrl: r.finalUrl, redirected: r.redirects.length > 0, chain: r.redirects, status: r.status };
    },
  },
  {
    slug: "dns",
    title: "DNS Lookup",
    description: "Lihat record DNS (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA) suatu domain via DNS-over-HTTPS.",
    params: [
      { name: "name", required: true, max: 253, pattern: DOMAIN, patternHint: "a valid domain like example.com", description: "Nama domain.", example: "example.com" },
      { name: "type", type: "enum", values: ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA"], default: "A", description: "Jenis record.", example: "A" },
    ],
    cache: 300,
    run: async (ctx) => {
      const name = ctx.q.name as string;
      const type = ctx.q.type as string;
      const map = (d: any) => {
        if (typeof d?.Status !== "number") throw new UpstreamError("bad shape");
        return {
          name,
          type,
          status: d.Status === 0 ? "NOERROR" : d.Status === 3 ? "NXDOMAIN" : `RCODE_${d.Status}`,
          records: (d.Answer ?? []).map((a: any) => ({ name: a.name, type: RR[a.type] ?? String(a.type), ttl: a.TTL, data: a.data })),
        };
      };
      return ctx.first([
        async () => map(await ctx.json(`https://dns.google/resolve?name=${enc(name)}&type=${type}`)),
        async () => map(await ctx.json(`https://cloudflare-dns.com/dns-query?name=${enc(name)}&type=${type}`, { headers: { Accept: "application/dns-json" } })),
      ]);
    },
  },
  {
    slug: "whois",
    title: "WHOIS / RDAP",
    description: "Info registrasi domain (registrar, tanggal dibuat/kedaluwarsa, nameserver) via RDAP.",
    params: [{ name: "domain", required: true, max: 253, pattern: DOMAIN, patternHint: "a valid domain like example.com", description: "Nama domain.", example: "example.com" }],
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://rdap.org/domain/${enc(ctx.q.domain as string)}`, { headers: { Accept: "application/rdap+json, application/json" } });
      if (!d?.ldhName) throw new UpstreamError("bad shape");
      const ev = (a: string) => (d.events ?? []).find((e: any) => e.eventAction === a)?.eventDate ?? null;
      const registrar = (d.entities ?? []).find((e: any) => (e.roles ?? []).includes("registrar"));
      const fn = registrar?.vcardArray?.[1]?.find((x: any[]) => x[0] === "fn")?.[3] ?? null;
      return {
        domain: d.ldhName,
        status: d.status ?? [],
        registrar: fn,
        createdAt: ev("registration"),
        updatedAt: ev("last changed"),
        expiresAt: ev("expiration"),
        nameservers: (d.nameservers ?? []).map((n: any) => String(n.ldhName).toLowerCase()),
        dnssec: Boolean(d.secureDNS?.delegationSigned),
      };
    },
  },
  {
    slug: "ip",
    title: "IP Geolocation",
    description: "Lokasi & jaringan sebuah alamat IP. Tanpa parameter = IP kamu sendiri.",
    params: [{ name: "ip", max: 45, pattern: /^[0-9a-fA-F:.]+$/, patternHint: "IPv4 or IPv6 address", description: "Alamat IP (opsional).", example: "8.8.8.8" }],
    cache: (q) => (q.ip ? 3600 : 0),
    run: async (ctx) => {
      const ip = (ctx.q.ip as string | undefined) ?? ctx.clientIp;
      if (!isIP(ip) || isPrivateIp(ip)) throw new ApiError(400, "invalid_parameter", "A public IPv4/IPv6 address is required (pass ?ip=).");
      return ctx.first([
        async () => {
          const d = await ctx.json<any>(`https://ipwho.is/${enc(ip)}`);
          if (!d?.success) throw new UpstreamError("failed");
          return { ip: d.ip, type: d.type, country: d.country, countryCode: d.country_code, region: d.region, city: d.city, latitude: d.latitude, longitude: d.longitude, timezone: d.timezone?.id ?? null, isp: d.connection?.isp ?? null, org: d.connection?.org ?? null, asn: d.connection?.asn ?? null };
        },
        async () => {
          const d = await ctx.json<any>(`https://ipapi.co/${enc(ip)}/json/`);
          if (!d?.ip || d.error) throw new UpstreamError("failed");
          return { ip: d.ip, type: d.version, country: d.country_name, countryCode: d.country_code, region: d.region, city: d.city, latitude: d.latitude, longitude: d.longitude, timezone: d.timezone ?? null, isp: null, org: d.org ?? null, asn: d.asn ?? null };
        },
      ]);
    },
  },
  {
    slug: "currency",
    title: "Currency Converter",
    description: "Konversi mata uang dengan kurs terbaru.",
    params: [
      { name: "from", default: "USD", max: 3, pattern: /^[A-Za-z]{3}$/, patternHint: "3-letter code like USD", description: "Mata uang asal.", example: "USD" },
      { name: "to", default: "IDR", max: 3, pattern: /^[A-Za-z]{3}$/, patternHint: "3-letter code like IDR", description: "Mata uang tujuan.", example: "IDR" },
      { name: "amount", type: "number", default: 1, min: 0.01, max: 1_000_000_000, description: "Jumlah.", example: 100 },
    ],
    cache: 1800,
    run: async (ctx) => {
      const from = (ctx.q.from as string).toUpperCase();
      const to = (ctx.q.to as string).toUpperCase();
      const amount = Number(ctx.q.amount);
      const res = await ctx.first<{ rate: number; updated: string | null }>([
        async () => {
          const d = await ctx.json<any>(`https://open.er-api.com/v6/latest/${from}`);
          const rate = d?.rates?.[to];
          if (d?.result !== "success" || typeof rate !== "number") throw new UpstreamError("no rate", 404);
          return { rate, updated: d.time_last_update_utc ?? null };
        },
        async () => {
          const d = await ctx.json<any>(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
          const rate = d?.rates?.[to];
          if (typeof rate !== "number") throw new UpstreamError("no rate", 404);
          return { rate, updated: d.date ?? null };
        },
      ]);
      return { from, to, amount, rate: res.rate, result: Math.round(amount * res.rate * 1e6) / 1e6, updated: res.updated };
    },
  },
  {
    slug: "crypto",
    title: "Crypto Price",
    description: "Harga, perubahan 24 jam, dan market cap kripto (id CoinGecko, mis. bitcoin,ethereum).",
    params: [
      { name: "ids", default: "bitcoin,ethereum", max: 200, pattern: /^[a-z0-9-]+(,[a-z0-9-]+){0,9}$/, patternHint: "comma-separated CoinGecko ids (max 10)", description: "Daftar id koin.", example: "bitcoin,ethereum" },
      { name: "vs", default: "usd", max: 10, pattern: /^[a-z]{2,10}$/, patternHint: "currency like usd, idr", description: "Mata uang pembanding.", example: "usd" },
    ],
    cache: 60,
    quota: true,
    run: async (ctx) => {
      const ids = (ctx.q.ids as string).split(",");
      const vs = ctx.q.vs as string;
      return ctx.first([
        async () => {
          const d = await ctx.json<any>(`https://api.coingecko.com/api/v3/simple/price?ids=${enc(ids.join(","))}&vs_currencies=${vs}&include_24hr_change=true&include_market_cap=true`);
          const out = ids.filter((id) => d?.[id]).map((id) => ({ id, price: d[id][vs] ?? null, change24h: d[id][`${vs}_24h_change`] ?? null, marketCap: d[id][`${vs}_market_cap`] ?? null }));
          if (out.length === 0) throw new UpstreamError("no data", 404);
          return { vs, coins: out };
        },
        async () => {
          const coins = await Promise.all(
            ids.map(async (id) => {
              const sym = CRYPTO_SYM[id];
              if (!sym) throw new UpstreamError("unsupported by fallback");
              const d = await ctx.json<any>(`https://api.coinbase.com/v2/prices/${sym}-${vs.toUpperCase()}/spot`);
              return { id, price: Number(d?.data?.amount) || null, change24h: null, marketCap: null };
            }),
          );
          return { vs, coins };
        },
      ]);
    },
  },
  {
    slug: "linkpreview",
    title: "Link Preview (Scraper)",
    description: "Ambil judul, deskripsi, gambar & favicon dari halaman web (scraping Open Graph). Dilindungi anti-SSRF.",
    params: [{ name: "url", type: "url", required: true, description: "URL halaman.", example: "https://github.com" }],
    cache: 3600,
    cost: 2,
    run: async (ctx) => {
      const r = await ctx.publicFetch(ctx.q.url as string, { method: "GET", maxBytes: 400_000, timeout: 8000, headers: { Accept: "text/html,application/xhtml+xml" } });
      if (r.status >= 400) throw new UpstreamError(`HTTP ${r.status}`, r.status);
      const ct = r.headers.get("content-type") ?? "";
      if (!/html/i.test(ct)) throw new ApiError(422, "unsupported_content", "The URL does not point to an HTML page.");
      const tags = metaTags(r.text);
      const meta = (...keys: string[]) => {
        for (const k of keys) {
          const m = tags.find((t) => t._tag === "meta" && (t.property?.toLowerCase() === k || t.name?.toLowerCase() === k) && t.content);
          if (m) return m.content.trim();
        }
        return null;
      };
      const rel = (re: RegExp) => tags.find((t) => t._tag === "link" && re.test(t.rel ?? "") && t.href);
      const title = meta("og:title", "twitter:title") ?? decodeEntities(r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim() ?? null;
      return {
        url: r.finalUrl,
        title: title || null,
        description: meta("og:description", "description", "twitter:description"),
        image: absUrl(meta("og:image", "twitter:image") ?? undefined, r.finalUrl),
        siteName: meta("og:site_name"),
        type: meta("og:type"),
        favicon: absUrl(rel(/\bicon\b/i)?.href ?? "/favicon.ico", r.finalUrl),
        canonical: absUrl(rel(/\bcanonical\b/i)?.href, r.finalUrl),
        themeColor: meta("theme-color"),
      };
    },
  },
  {
    slug: "website-status",
    title: "Website Status",
    description: "Cek apakah sebuah website online, kode status, dan waktu responsnya.",
    params: [{ name: "url", type: "url", required: true, description: "URL website.", example: "https://example.com" }],
    cache: 30,
    cost: 2,
    run: async (ctx) => {
      const url = ctx.q.url as string;
      let r = await ctx.publicFetch(url, { method: "HEAD", timeout: 7000 }).catch(() => null);
      if (!r || r.status >= 400) {
        const g = await ctx.publicFetch(url, { method: "GET", maxBytes: 50_000, timeout: 8000 }).catch(() => null);
        r = g ?? r;
      }
      if (!r) return { url, online: false, status: null, latencyMs: null, finalUrl: null, redirects: 0, contentType: null };
      return { url, online: r.status < 500, status: r.status, latencyMs: r.ms, finalUrl: r.finalUrl, redirects: r.redirects.length, contentType: r.headers.get("content-type") };
    },
  },
  {
    slug: "screenshot",
    title: "Website Screenshot",
    description: "URL screenshot sebuah website (dibuat oleh layanan thum.io saat URL dibuka).",
    params: [
      { name: "url", type: "url", required: true, description: "URL website.", example: "https://example.com" },
      { name: "width", type: "number", default: 1280, min: 320, max: 1920, description: "Lebar viewport (px).", example: 1280 },
      { name: "height", type: "number", default: 720, min: 200, max: 1440, description: "Tinggi crop (px).", example: 720 },
    ],
    cache: 3600,
    run: async (ctx) => {
      const width = Math.round(Number(ctx.q.width));
      const height = Math.round(Number(ctx.q.height));
      const url = ctx.q.url as string;
      return { url, width, height, image: `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${url}` };
    },
  },
  {
    slug: "hash",
    title: "Hash",
    description: "Hitung hash teks (md5, sha1, sha256, sha384, sha512).",
    params: [
      { name: "text", required: true, max: 3000, description: "Teks input.", example: "wanspace" },
      { name: "algo", type: "enum", values: ["md5", "sha1", "sha256", "sha384", "sha512"], default: "sha256", description: "Algoritma.", example: "sha256" },
    ],
    cache: 86400,
    run: async (ctx) => {
      const h = createHash(ctx.q.algo as string).update(ctx.q.text as string, "utf8");
      const buf = h.digest();
      return { algo: ctx.q.algo, hex: buf.toString("hex"), base64: buf.toString("base64"), bits: buf.length * 8 };
    },
  },
  {
    slug: "encode",
    title: "Encode / Decode",
    description: "Encode atau decode teks: base64, base64url, url, hex, binary, html.",
    params: [
      { name: "text", required: true, max: 3000, description: "Teks input.", example: "Halo Dunia" },
      { name: "type", type: "enum", values: ["base64", "base64url", "url", "hex", "binary", "html"], default: "base64", description: "Format.", example: "base64" },
      { name: "mode", type: "enum", values: ["encode", "decode"], default: "encode", description: "Arah konversi.", example: "encode" },
    ],
    cache: 86400,
    run: async (ctx) => {
      const text = ctx.q.text as string;
      const type = ctx.q.type as string;
      const dec = ctx.q.mode === "decode";
      const bad = () => new ApiError(400, "invalid_parameter", `Input is not valid ${type}.`);
      let output: string;
      switch (type) {
        case "base64":
        case "base64url":
          if (dec && !(type === "base64" ? /^[A-Za-z0-9+/=\s]*$/ : /^[A-Za-z0-9_\-=\s]*$/).test(text)) throw bad();
          output = dec ? Buffer.from(text, type).toString("utf8") : Buffer.from(text, "utf8").toString(type);
          break;
        case "url":
          try {
            output = dec ? decodeURIComponent(text) : encodeURIComponent(text);
          } catch {
            throw bad();
          }
          break;
        case "hex": {
          const clean = text.replace(/\s+/g, "");
          if (dec && (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2)) throw bad();
          output = dec ? Buffer.from(clean, "hex").toString("utf8") : Buffer.from(text, "utf8").toString("hex");
          break;
        }
        case "binary": {
          if (dec) {
            const bits = text.replace(/\s+/g, "");
            if (!/^[01]*$/.test(bits) || bits.length % 8) throw bad();
            output = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2))).toString("utf8");
          } else {
            output = [...Buffer.from(text, "utf8")].map((b) => b.toString(2).padStart(8, "0")).join(" ");
          }
          break;
        }
        default:
          output = dec ? decodeEntities(text) : text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
      }
      return { type, mode: dec ? "decode" : "encode", input: text, output };
    },
  },
  {
    slug: "uuid",
    title: "UUID Generator",
    description: "Buat UUID v4 acak.",
    params: [{ name: "count", type: "number", default: 1, min: 1, max: 20, description: "Jumlah UUID.", example: 3 }],
    cache: 0,
    run: async (ctx) => ({ count: Number(ctx.q.count), uuids: Array.from({ length: Math.round(Number(ctx.q.count)) }, () => randomUUID()) }),
  },
  {
    slug: "lorem",
    title: "Lorem Ipsum",
    description: "Teks dummy lorem ipsum.",
    params: [
      { name: "paragraphs", type: "number", default: 2, min: 1, max: 10, description: "Jumlah paragraf.", example: 2 },
      { name: "words", type: "number", default: 40, min: 10, max: 120, description: "Kata per paragraf.", example: 40 },
    ],
    cache: 0,
    run: async (ctx) => {
      const n = Math.round(Number(ctx.q.paragraphs));
      const w = Math.round(Number(ctx.q.words));
      const para = () => {
        const words = Array.from({ length: w }, () => LOREM[randomInt(LOREM.length)]);
        words[0] = words[0][0].toUpperCase() + words[0].slice(1);
        return `${words.join(" ")}.`;
      };
      return { paragraphs: Array.from({ length: n }, para) };
    },
  },
  {
    slug: "color",
    title: "Color Converter",
    description: "Konversi warna (hex / rgb / hsl) + kontras teks, warna komplementer dan palet.",
    params: [{ name: "value", required: true, max: 40, description: "Warna: #ff5733, 255,87,51 atau hsl(11,100%,60%).", example: "#ff5733" }],
    cache: 86400,
    run: async (ctx) => {
      const [r, g, b] = parseColor(ctx.q.value as string);
      const [h, s, l] = rgbToHsl(r, g, b);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const shade = (lv: number) => toHex(...hslToRgb(h, s, clamp(lv, 0, 100)));
      return {
        hex: toHex(r, g, b),
        rgb: { r, g, b, css: `rgb(${r}, ${g}, ${b})` },
        hsl: { h, s, l, css: `hsl(${h}, ${s}%, ${l}%)` },
        luminance: Math.round(lum * 1000) / 1000,
        textColor: lum > 0.55 ? "#000000" : "#ffffff",
        complementary: toHex(...hslToRgb((h + 180) % 360, s, l)),
        palette: [90, 70, 50, 30, 10].map(shade),
      };
    },
  },
  {
    slug: "textutil",
    title: "Text Utilities",
    description: "Transformasi teks: slug, upper, lower, title, camel, snake, kebab, reverse, count.",
    params: [
      { name: "text", required: true, max: 2000, description: "Teks input.", example: "Halo Dunia Wanspace API" },
      { name: "mode", type: "enum", values: ["slug", "upper", "lower", "title", "camel", "snake", "kebab", "reverse", "count"], default: "slug", description: "Jenis transformasi.", example: "slug" },
    ],
    cache: 86400,
    run: async (ctx) => {
      const t = ctx.q.text as string;
      const mode = ctx.q.mode as string;
      const words = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
      switch (mode) {
        case "slug":
        case "kebab":
          return { mode, result: words.join("-") };
        case "snake":
          return { mode, result: words.join("_") };
        case "camel":
          return { mode, result: words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("") };
        case "upper":
          return { mode, result: t.toUpperCase() };
        case "lower":
          return { mode, result: t.toLowerCase() };
        case "title":
          return { mode, result: t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) };
        case "reverse":
          return { mode, result: [...t].reverse().join("") };
        default: {
          const wc = (t.match(/[\p{L}\p{N}']+/gu) ?? []).length;
          return { mode, result: { characters: [...t].length, words: wc, lines: t.split(/\r?\n/).length, sentences: (t.match(/[.!?]+(\s|$)/g) ?? []).length || (t.trim() ? 1 : 0), readingTimeMinutes: Math.max(1, Math.round(wc / 200)) } };
        }
      }
    },
  },
]);
