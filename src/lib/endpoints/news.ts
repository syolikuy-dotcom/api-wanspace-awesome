import { group, enc, LIMIT_PARAM } from "../api/define";
import { UpstreamError } from "../api/errors";
import { parseFeed } from "../api/xml";
import type { EndpointInput } from "../api/types";

interface Source {
  slug: string;
  name: string;
  desc: string;
  feeds: Record<string, string>;
}

const SOURCES: Source[] = [
  {
    slug: "antara",
    name: "Antara News",
    desc: "Berita Indonesia dari Antara.",
    feeds: {
      terkini: "https://www.antaranews.com/rss/terkini.xml",
      politik: "https://www.antaranews.com/rss/politik.xml",
      ekonomi: "https://www.antaranews.com/rss/ekonomi.xml",
      olahraga: "https://www.antaranews.com/rss/olahraga.xml",
      tekno: "https://www.antaranews.com/rss/tekno.xml",
      hiburan: "https://www.antaranews.com/rss/hiburan.xml",
      dunia: "https://www.antaranews.com/rss/dunia.xml",
    },
  },
  {
    slug: "cnn",
    name: "CNN Indonesia",
    desc: "Berita dari CNN Indonesia.",
    feeds: {
      terbaru: "https://www.cnnindonesia.com/rss",
      nasional: "https://www.cnnindonesia.com/nasional/rss",
      internasional: "https://www.cnnindonesia.com/internasional/rss",
      ekonomi: "https://www.cnnindonesia.com/ekonomi/rss",
      olahraga: "https://www.cnnindonesia.com/olahraga/rss",
      teknologi: "https://www.cnnindonesia.com/teknologi/rss",
      hiburan: "https://www.cnnindonesia.com/hiburan/rss",
      "gaya-hidup": "https://www.cnnindonesia.com/gaya-hidup/rss",
    },
  },
  {
    slug: "detik",
    name: "Detik",
    desc: "Berita dari Detik.",
    feeds: {
      news: "https://news.detik.com/berita/rss",
      finance: "https://finance.detik.com/rss",
      sport: "https://sport.detik.com/rss",
      inet: "https://inet.detik.com/rss",
      hot: "https://hot.detik.com/rss",
      oto: "https://oto.detik.com/rss",
      health: "https://health.detik.com/rss",
    },
  },
  {
    slug: "tempo",
    name: "Tempo",
    desc: "Berita dari Tempo.co.",
    feeds: {
      nasional: "https://rss.tempo.co/nasional",
      dunia: "https://rss.tempo.co/dunia",
      bisnis: "https://rss.tempo.co/bisnis",
      olahraga: "https://rss.tempo.co/olahraga",
      tekno: "https://rss.tempo.co/tekno",
    },
  },
  { slug: "republika", name: "Republika", desc: "Berita terbaru dari Republika.", feeds: { terbaru: "https://www.republika.co.id/rss" } },
  {
    slug: "bbc",
    name: "BBC News",
    desc: "International news from BBC.",
    feeds: {
      top: "https://feeds.bbci.co.uk/news/rss.xml",
      world: "https://feeds.bbci.co.uk/news/world/rss.xml",
      technology: "https://feeds.bbci.co.uk/news/technology/rss.xml",
      business: "https://feeds.bbci.co.uk/news/business/rss.xml",
      science: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
      health: "https://feeds.bbci.co.uk/news/health/rss.xml",
    },
  },
  { slug: "techcrunch", name: "TechCrunch", desc: "Startup & tech news from TechCrunch.", feeds: { latest: "https://techcrunch.com/feed/" } },
  { slug: "theverge", name: "The Verge", desc: "Tech, science & culture from The Verge.", feeds: { latest: "https://www.theverge.com/rss/index.xml" } },
];

const rss = (s: Source): EndpointInput => {
  const cats = Object.keys(s.feeds);
  return {
    slug: s.slug,
    title: s.name,
    description: `${s.desc} Kategori: ${cats.join(", ")}.`,
    params: [
      { name: "category", type: "enum", values: cats, default: cats[0], description: "Kategori berita.", example: cats[0] },
      LIMIT_PARAM(10, 30),
    ],
    cache: 300,
    tags: ["news", "rss", s.slug],
    run: async (ctx) => {
      const category = ctx.q.category as string;
      const xml = await ctx.text(s.feeds[category], { maxBytes: 3_000_000 });
      const items = parseFeed(xml, Number(ctx.q.limit));
      if (items.length === 0) throw new UpstreamError("empty feed");
      return { source: s.name, category, total: items.length, items };
    },
  };
};

export default group("news", [
  ...SOURCES.map(rss),
  {
    slug: "search",
    title: "Search News",
    description: "Cari berita dari ribuan sumber lewat Google News.",
    params: [
      { name: "q", required: true, max: 150, description: "Kata kunci.", example: "teknologi AI" },
      { name: "lang", type: "enum", values: ["id", "en"], default: "id", description: "Bahasa/negara hasil.", example: "id" },
      LIMIT_PARAM(10, 30),
    ],
    cache: 300,
    tags: ["news", "google"],
    run: async (ctx) => {
      const id = ctx.q.lang === "id";
      const url = `https://news.google.com/rss/search?q=${enc(ctx.q.q as string)}&hl=${id ? "id" : "en-US"}&gl=${id ? "ID" : "US"}&ceid=${id ? "ID:id" : "US:en"}`;
      const items = parseFeed(await ctx.text(url, { maxBytes: 3_000_000 }), Number(ctx.q.limit));
      if (items.length === 0) throw new UpstreamError("empty feed", 404);
      return { query: ctx.q.q, total: items.length, items };
    },
  },
  {
    slug: "hackernews",
    title: "Hacker News",
    description: "Cerita teratas Hacker News (top, new, best, ask, show, job).",
    params: [
      { name: "type", type: "enum", values: ["top", "new", "best", "ask", "show", "job"], default: "top", description: "Jenis daftar.", example: "top" },
      LIMIT_PARAM(10, 20),
    ],
    cache: 300,
    run: async (ctx) => {
      const ids = await ctx.json<number[]>(`https://hacker-news.firebaseio.com/v0/${ctx.q.type}stories.json`);
      if (!Array.isArray(ids)) throw new UpstreamError("bad shape");
      const items = await Promise.all(ids.slice(0, Number(ctx.q.limit)).map((id) => ctx.json<any>(`https://hacker-news.firebaseio.com/v0/item/${Math.floor(Number(id))}.json`).catch(() => null)));
      return items
        .filter((i): i is any => Boolean(i && i.title))
        .map((i) => ({
          id: i.id,
          title: i.title,
          url: i.url ?? `https://news.ycombinator.com/item?id=${i.id}`,
          score: i.score ?? 0,
          author: i.by ?? null,
          comments: i.descendants ?? 0,
          time: i.time ? new Date(i.time * 1000).toISOString() : null,
        }));
    },
  },
]);
