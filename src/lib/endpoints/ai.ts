import { group, enc, clamp, LIMIT_PARAM } from "../api/define";
import { ApiError, UpstreamError } from "../api/errors";

const LANG = /^(auto|[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?)$/;
const LANG_HINT = "use a language code such as en, id, ja, zh-CN";

const STOP = new Set(
  ("a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they " +
    "dan atau tetapi yang di ke dari untuk dengan pada itu ini adalah akan juga sudah telah tidak ada oleh dalam sebagai karena agar saya kami kita mereka dia").split(" "),
);

function summarize(text: string, n: number): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
  if (sentences.length <= n) return sentences.length ? sentences : [text.trim()];

  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (w.length < 3 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const score = words.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.sqrt(words.length || 1);
    return { s, i, score: score * (i === 0 ? 1.25 : 1) };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

export default group("ai", [
  {
    slug: "chat",
    title: "AI Chat",
    description: "Tanya apa saja ke model bahasa AI. Tanpa API key. Sumber AI gratis bisa lambat/penuh — cek halaman Status.",
    params: [
      { name: "text", required: true, max: 1500, description: "Pertanyaan / prompt.", example: "Jelaskan apa itu REST API dalam 2 kalimat" },
      { name: "system", max: 400, description: "Instruksi sistem opsional (gaya/peran AI).", example: "Jawab singkat dalam bahasa Indonesia" },
      { name: "model", default: "openai", max: 40, pattern: /^[a-z0-9][a-z0-9._-]*$/i, patternHint: "letters, numbers, . _ -", description: "Nama model (default openai).", example: "openai" },
    ],
    cache: 120,
    cost: 4,
    quota: true,
    tags: ["ai", "chatgpt", "llm"],
    run: async (ctx) => {
      const text = ctx.q.text as string;
      const system = ctx.q.system as string | undefined;
      const model = ctx.q.model as string;
      const answer = await ctx.first<string>([
        async () => {
          const t = await ctx.text(`https://text.pollinations.ai/${enc(text)}?model=${enc(model)}${system ? `&system=${enc(system)}` : ""}`, { timeout: 25000 });
          if (!t.trim()) throw new UpstreamError("empty");
          return t.trim();
        },
        async () => {
          const r = await ctx.json<any>("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: text }] }),
            timeout: 25000,
          });
          const c = r?.choices?.[0]?.message?.content;
          if (typeof c !== "string" || !c.trim()) throw new UpstreamError("empty");
          return c.trim();
        },
      ]);
      return { model, prompt: text, answer };
    },
  },
  {
    slug: "translate",
    title: "Translate",
    description: "Terjemahkan teks ke bahasa apa pun (deteksi bahasa otomatis).",
    params: [
      { name: "text", required: true, max: 1500, description: "Teks yang diterjemahkan.", example: "Hello, how are you?" },
      { name: "to", default: "id", pattern: LANG, patternHint: LANG_HINT, max: 10, description: "Bahasa tujuan.", example: "id" },
      { name: "from", default: "auto", pattern: LANG, patternHint: LANG_HINT, max: 10, description: "Bahasa asal (auto = deteksi).", example: "auto" },
    ],
    cache: 86400,
    tags: ["translate", "bahasa"],
    run: async (ctx) => {
      const text = ctx.q.text as string;
      const to = ctx.q.to as string;
      const from = ctx.q.from as string;
      return ctx.first([
        async () => {
          const d = await ctx.json<any>(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${enc(from)}&tl=${enc(to)}&dt=t&q=${enc(text)}`);
          const segs = Array.isArray(d?.[0]) ? d[0] : [];
          const translated = segs.map((s: any) => (typeof s?.[0] === "string" ? s[0] : "")).join("");
          if (!translated) throw new UpstreamError("empty");
          return { text, translated, from: typeof d?.[2] === "string" ? d[2] : from, to };
        },
        async () => {
          if (text.length > 480) throw new UpstreamError("too long for fallback");
          const d = await ctx.json<any>(`https://api.mymemory.translated.net/get?q=${enc(text)}&langpair=${enc(from === "auto" ? "en" : from)}|${enc(to)}`);
          const translated = d?.responseData?.translatedText;
          if (typeof translated !== "string" || !translated) throw new UpstreamError("empty");
          return { text, translated, from: from === "auto" ? "en" : from, to };
        },
      ]);
    },
  },
  {
    slug: "detect-language",
    title: "Detect Language",
    description: "Deteksi bahasa dari sebuah teks.",
    params: [{ name: "text", required: true, max: 1000, description: "Teks yang dideteksi.", example: "Selamat pagi semuanya" }],
    cache: 86400,
    run: async (ctx) => {
      const text = ctx.q.text as string;
      const d = await ctx.json<any>(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${enc(text)}`);
      const lang = d?.[2];
      if (typeof lang !== "string") throw new UpstreamError("no language");
      let name: string | null = null;
      try {
        name = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? null;
      } catch {
        /* abaikan */
      }
      return { text, language: lang, name };
    },
  },
  {
    slug: "summarize",
    title: "Summarize",
    description: "Ringkas teks panjang menjadi beberapa kalimat penting (ekstraktif, berjalan lokal tanpa upstream).",
    params: [
      {
        name: "text",
        required: true,
        max: 3000,
        description: "Teks yang diringkas.",
        example:
          "REST API adalah gaya arsitektur untuk membangun layanan web. Klien mengirim permintaan HTTP ke sebuah URL dan server mengembalikan data, biasanya dalam format JSON. " +
          "Karena sifatnya yang sederhana, REST API banyak dipakai untuk aplikasi web dan mobile. Banyak layanan menyediakan REST API agar developer dapat mengambil data dengan mudah. " +
          "Rate limit dipakai untuk melindungi REST API dari penyalahgunaan dan menjaga layanan tetap stabil bagi semua pengguna.",
      },
      { name: "sentences", type: "number", default: 2, min: 1, max: 8, description: "Jumlah kalimat ringkasan.", example: 2 },
    ],
    cache: 3600,
    run: async (ctx) => {
      const text = ctx.q.text as string;
      const n = clamp(Number(ctx.q.sentences), 1, 8);
      const picked = summarize(text, n);
      const summary = picked.join(" ");
      return { summary, sentences: picked.length, originalLength: text.length, summaryLength: summary.length };
    },
  },
  {
    slug: "image",
    title: "Text to Image",
    description: "Buat gambar dari deskripsi teks. Mengembalikan URL gambar siap pakai (pembuatan dilakukan saat URL dibuka).",
    params: [
      { name: "prompt", required: true, max: 400, description: "Deskripsi gambar.", example: "a cozy cabin in snowy mountains, digital art" },
      { name: "width", type: "number", default: 768, min: 256, max: 1536, description: "Lebar (px).", example: 768 },
      { name: "height", type: "number", default: 768, min: 256, max: 1536, description: "Tinggi (px).", example: 768 },
      { name: "seed", type: "number", min: 0, max: 999999, description: "Seed agar hasil bisa diulang.", example: 42 },
    ],
    cache: (q) => (q.seed === undefined ? 0 : 3600),
    cost: 2,
    run: async (ctx) => {
      const prompt = ctx.q.prompt as string;
      const width = Math.round(Number(ctx.q.width));
      const height = Math.round(Number(ctx.q.height));
      const seed = ctx.q.seed === undefined ? Math.floor(Math.random() * 1_000_000) : Math.round(Number(ctx.q.seed));
      if (!prompt.trim()) throw new ApiError(400, "invalid_parameter", "Prompt must not be empty.");
      return {
        prompt,
        width,
        height,
        seed,
        url: `https://image.pollinations.ai/prompt/${enc(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`,
      };
    },
  },
]);
