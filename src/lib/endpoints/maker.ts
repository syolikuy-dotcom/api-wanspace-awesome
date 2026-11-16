import { createHash } from "node:crypto";
import { group, enc, escapeXml, clamp } from "../api/define";
import { UpstreamError } from "../api/errors";
import { binary } from "../api/types";

const HEX = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HEX_HINT = "hex color without #, e.g. 0f172a";
const svg = (s: string) => binary(new TextEncoder().encode(s), "image/svg+xml; charset=utf-8");
const hex6 = (h: string) => (h.length === 3 ? h.split("").map((c) => c + c).join("") : h);

/** Aturan escape memegen.link */
const memeText = (t: string) =>
  t.trim() === ""
    ? "_"
    : enc(
        t
          .replace(/_/g, "__")
          .replace(/-/g, "--")
          .replace(/ /g, "_")
          .replace(/\?/g, "~q")
          .replace(/%/g, "~p")
          .replace(/#/g, "~h")
          .replace(/\//g, "~s")
          .replace(/\\/g, "~b")
          .replace(/"/g, "''")
          .replace(/\n/g, "~n"),
      ).replace(/%7E/gi, "~").replace(/%27%27/g, "''");

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const THEMES: Record<string, { bg: string[]; fg: string; sub: string }> = {
  light: { bg: ["#ffffff", "#f1f5f9"], fg: "#0f172a", sub: "#64748b" },
  dark: { bg: ["#09090b", "#18181b"], fg: "#f4f4f5", sub: "#a1a1aa" },
  sunset: { bg: ["#f97316", "#db2777"], fg: "#ffffff", sub: "#ffe4e6" },
  ocean: { bg: ["#0ea5e9", "#4f46e5"], fg: "#ffffff", sub: "#e0e7ff" },
};

const alpha = (upper: number, lower: number, digit?: number, ex: Record<string, string> = {}) => (s: string) =>
  [...s]
    .map((ch) => {
      if (ex[ch]) return ex[ch];
      const c = ch.codePointAt(0)!;
      if (c >= 65 && c <= 90) return String.fromCodePoint(upper + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(lower + c - 97);
      if (digit !== undefined && c >= 48 && c <= 57) return String.fromCodePoint(digit + c - 48);
      return ch;
    })
    .join("");

const circled = (s: string) =>
  [...s]
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + c - 97);
      if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49);
      if (c === 48) return "⓪";
      return ch;
    })
    .join("");

const FANCY: Record<string, (s: string) => string> = {
  bold: alpha(0x1d400, 0x1d41a, 0x1d7ce),
  italic: alpha(0x1d434, 0x1d44e, undefined, { h: "ℎ" }),
  "bold-italic": alpha(0x1d468, 0x1d482),
  "sans-bold": alpha(0x1d5d4, 0x1d5ee, 0x1d7ec),
  mono: alpha(0x1d670, 0x1d68a, 0x1d7f6),
  double: alpha(0x1d538, 0x1d552, 0x1d7d8, { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" }),
  circled,
  wide: (s) => [...s].map((ch) => (ch === " " ? "\u3000" : ch.charCodeAt(0) >= 33 && ch.charCodeAt(0) <= 126 ? String.fromCharCode(ch.charCodeAt(0) + 0xfee0) : ch)).join(""),
};

export default group("maker", [
  {
    slug: "avatar",
    title: "Avatar Generator",
    description: "Avatar SVG unik dari seed (DiceBear). Seed yang sama = avatar yang sama.",
    params: [
      { name: "seed", default: "wanspace", max: 60, description: "Teks seed.", example: "wanspace" },
      { name: "style", type: "enum", values: ["adventurer", "avataaars", "bottts", "fun-emoji", "identicon", "initials", "lorelei", "micah", "notionists", "pixel-art", "shapes", "thumbs"], default: "thumbs", description: "Gaya avatar.", example: "thumbs" },
    ],
    output: "svg",
    cache: 86400,
    run: async (ctx) => {
      const img = await ctx.bin(`https://api.dicebear.com/9.x/${ctx.q.style}/svg?seed=${enc(ctx.q.seed as string)}`);
      if (!/svg/i.test(img.contentType)) throw new UpstreamError("not svg");
      return binary(img.body, "image/svg+xml; charset=utf-8");
    },
  },
  {
    slug: "meme",
    title: "Meme Maker",
    description: "Buat meme dari template populer dengan teks atas & bawah (memegen.link). Mengembalikan gambar PNG.",
    params: [
      { name: "template", type: "enum", values: ["buzz", "doge", "drake", "fry", "success", "rollsafe", "db", "mordor", "wonka", "yuno"], default: "drake", description: "Template meme.", example: "drake" },
      { name: "top", max: 80, description: "Teks atas.", example: "Pakai API berbayar" },
      { name: "bottom", max: 80, description: "Teks bawah.", example: "Pakai api.wanspace.biz.id" },
    ],
    output: "image",
    cache: 86400,
    run: async (ctx) => {
      const url = `https://api.memegen.link/images/${ctx.q.template}/${memeText((ctx.q.top as string) ?? "")}/${memeText((ctx.q.bottom as string) ?? "")}.png`;
      const img = await ctx.bin(url);
      if (!img.contentType.startsWith("image/")) throw new UpstreamError("not an image");
      return binary(img.body, img.contentType.split(";")[0]);
    },
  },
  {
    slug: "placeholder",
    title: "Placeholder Image",
    description: "Gambar placeholder SVG dengan ukuran, warna & teks kustom.",
    params: [
      { name: "width", type: "number", default: 600, min: 16, max: 2000, description: "Lebar (px).", example: 600 },
      { name: "height", type: "number", default: 400, min: 16, max: 2000, description: "Tinggi (px).", example: 400 },
      { name: "text", max: 60, description: "Teks (default: ukuran).", example: "Hero Image" },
      { name: "bg", default: "e2e8f0", pattern: HEX, patternHint: HEX_HINT, max: 6, description: "Warna latar (hex).", example: "e2e8f0" },
      { name: "fg", default: "334155", pattern: HEX, patternHint: HEX_HINT, max: 6, description: "Warna teks (hex).", example: "334155" },
    ],
    output: "svg",
    cache: 86400,
    run: async (ctx) => {
      const w = Math.round(Number(ctx.q.width));
      const h = Math.round(Number(ctx.q.height));
      const text = escapeXml((ctx.q.text as string | undefined) ?? `${w} × ${h}`);
      const fs = clamp(Math.min(w / Math.max(text.length * 0.6, 4), h / 3), 10, 120);
      return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#${hex6(ctx.q.bg as string)}"/><text x="50%" y="50%" fill="#${hex6(ctx.q.fg as string)}" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="${fs.toFixed(0)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`);
    },
  },
  {
    slug: "badge",
    title: "Badge Maker",
    description: "Badge ala shields.io (SVG) untuk README atau website.",
    params: [
      { name: "label", required: true, max: 30, description: "Teks kiri.", example: "api" },
      { name: "message", required: true, max: 30, description: "Teks kanan.", example: "online" },
      { name: "color", default: "16a34a", pattern: HEX, patternHint: HEX_HINT, max: 6, description: "Warna sisi kanan (hex).", example: "16a34a" },
    ],
    output: "svg",
    cache: 86400,
    run: async (ctx) => {
      const label = ctx.q.label as string;
      const message = ctx.q.message as string;
      const lw = Math.round(label.length * 6.6 + 20);
      const mw = Math.round(message.length * 6.6 + 20);
      const w = lw + mw;
      return svg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22" viewBox="0 0 ${w} 22" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}"><clipPath id="r"><rect width="${w}" height="22" rx="4"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="22" fill="#334155"/><rect x="${lw}" width="${mw}" height="22" fill="#${hex6(ctx.q.color as string)}"/></g><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${lw / 2}" y="15">${escapeXml(label)}</text><text x="${lw + mw / 2}" y="15">${escapeXml(message)}</text></g></svg>`,
      );
    },
  },
  {
    slug: "quote-card",
    title: "Quote Card",
    description: "Kartu kutipan siap bagikan (SVG 1080×1080) dengan 4 tema.",
    params: [
      { name: "text", required: true, max: 240, description: "Isi kutipan.", example: "Kode yang baik adalah kode yang mudah dibaca." },
      { name: "author", max: 60, description: "Nama penulis.", example: "Wanspace" },
      { name: "theme", type: "enum", values: Object.keys(THEMES), default: "dark", description: "Tema warna.", example: "dark" },
    ],
    output: "svg",
    cache: 86400,
    run: async (ctx) => {
      const t = THEMES[ctx.q.theme as string];
      const lines = wrap(ctx.q.text as string, 26).slice(0, 10);
      const fs = lines.length > 7 ? 44 : lines.length > 4 ? 56 : 68;
      const lh = fs * 1.35;
      const startY = 540 - ((lines.length - 1) * lh) / 2;
      const author = ctx.q.author ? `<text x="540" y="${startY + lines.length * lh + 40}" fill="${t.sub}" font-size="34" text-anchor="middle">— ${escapeXml(ctx.q.author as string)}</text>` : "";
      const body = lines.map((l, i) => `<text x="540" y="${(startY + i * lh).toFixed(0)}" text-anchor="middle">${escapeXml(l)}</text>`).join("");
      return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg[0]}"/><stop offset="1" stop-color="${t.bg[1]}"/></linearGradient></defs><rect width="1080" height="1080" fill="url(#g)"/><text x="90" y="200" fill="${t.sub}" font-size="220" font-family="Georgia,serif" opacity=".5">“</text><g fill="${t.fg}" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="${fs}" font-weight="600">${body}</g><g font-family="Poppins,Segoe UI,Arial,sans-serif">${author}</g></svg>`);
    },
  },
  {
    slug: "gradient",
    title: "Gradient Generator",
    description: "Gradient SVG unik dari seed — cocok untuk cover/background.",
    params: [
      { name: "seed", default: "wanspace", max: 60, description: "Teks seed.", example: "wanspace" },
      { name: "width", type: "number", default: 1200, min: 16, max: 3000, description: "Lebar (px).", example: 1200 },
      { name: "height", type: "number", default: 630, min: 16, max: 3000, description: "Tinggi (px).", example: 630 },
    ],
    output: "svg",
    cache: 86400,
    run: async (ctx) => {
      const b = createHash("sha256").update(ctx.q.seed as string).digest();
      const c = (i: number) => `hsl(${Math.round((b[i] / 255) * 360)},${70 + (b[i + 1] % 25)}%,${50 + (b[i + 2] % 15)}%)`;
      const angle = Math.round((b[9] / 255) * 360);
      const w = Math.round(Number(ctx.q.width));
      const h = Math.round(Number(ctx.q.height));
      return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${c(0)}"/><stop offset=".55" stop-color="${c(3)}"/><stop offset="1" stop-color="${c(6)}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    },
  },
  {
    slug: "fancy-text",
    title: "Fancy Text",
    description: "Ubah teks menjadi gaya unik Unicode (bold, italic, mono, circled, wide, dll.). Isi `style=all` untuk semua gaya.",
    params: [
      { name: "text", required: true, max: 200, description: "Teks input.", example: "Wanspace API" },
      { name: "style", type: "enum", values: ["all", ...Object.keys(FANCY)], default: "all", description: "Gaya teks.", example: "all" },
    ],
    cache: 86400,
    run: async (ctx) => {
      const text = ctx.q.text as string;
      const style = ctx.q.style as string;
      if (style !== "all") return { text, style, result: FANCY[style](text) };
      return { text, results: Object.fromEntries(Object.entries(FANCY).map(([k, fn]) => [k, fn(text)])) };
    },
  },
]);
