import { group, enc, clamp, LIMIT_PARAM } from "../api/define";
import { ApiError, UpstreamError } from "../api/errors";

const J = "https://api.jikan.moe/v4";
const names = (a: any): string[] => (Array.isArray(a) ? a.map((x) => x?.name).filter(Boolean) : []);
const img = (o: any): string | null => o?.images?.jpg?.large_image_url ?? o?.images?.jpg?.image_url ?? null;
const isAdult = (a: any) => /Rx|Hentai/i.test(String(a?.rating ?? "")) || names(a?.genres).some((g) => /hentai|erotica/i.test(g));

const mapAnime = (a: any) => ({
  id: a.mal_id,
  title: a.title,
  titleEnglish: a.title_english ?? null,
  type: a.type ?? null,
  episodes: a.episodes ?? null,
  status: a.status ?? null,
  score: a.score ?? null,
  rank: a.rank ?? null,
  year: a.year ?? null,
  season: a.season ?? null,
  rating: a.rating ?? null,
  genres: names(a.genres),
  synopsis: a.synopsis ?? null,
  image: img(a),
  trailer: a.trailer?.url ?? null,
  url: a.url ?? null,
});

const list = (d: any): any[] => (Array.isArray(d?.data) ? d.data : []);

const WAIFU_TYPES = ["waifu", "neko", "shinobu", "megumin", "cuddle", "cry", "hug", "kiss", "pat", "smug", "bonk", "blush", "smile", "wave", "happy", "wink", "poke", "dance", "husbando", "kitsune"] as const;
const NEKOS_MAP: Record<string, string> = { waifu: "waifu", neko: "neko", shinobu: "waifu", megumin: "waifu", cuddle: "cuddle", cry: "cry", hug: "hug", kiss: "kiss", pat: "pat", smug: "smug", bonk: "punch", blush: "blush", smile: "smile", wave: "wave", happy: "happy", wink: "wink", poke: "poke", dance: "dance", husbando: "husbando", kitsune: "kitsune" };
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export default group("anime", [
  {
    slug: "search",
    title: "Search Anime",
    description: "Cari anime berdasarkan judul (data MyAnimeList via Jikan, konten dewasa disaring).",
    params: [{ name: "q", required: true, max: 100, description: "Judul anime.", example: "naruto" }, LIMIT_PARAM(10, 25)],
    cache: 3600,
    quota: true,
    tags: ["anime", "mal", "jikan"],
    run: async (ctx) => {
      const d = await ctx.json<any>(`${J}/anime?q=${enc(ctx.q.q as string)}&limit=${ctx.q.limit}&sfw=true`);
      return list(d).map(mapAnime);
    },
  },
  {
    slug: "info",
    title: "Anime Info",
    description: "Detail lengkap satu anime berdasarkan ID MyAnimeList.",
    params: [{ name: "id", type: "number", required: true, min: 1, max: 999999, description: "ID MyAnimeList.", example: 20 }],
    cache: 21600,
    quota: true,
    run: async (ctx) => {
      const d = await ctx.json<any>(`${J}/anime/${Math.floor(Number(ctx.q.id))}/full`);
      const a = d?.data;
      if (!a) throw new UpstreamError("empty", 404);
      if (isAdult(a)) throw new ApiError(404, "not_found", "No data found for this request.");
      return {
        ...mapAnime(a),
        aired: a.aired?.string ?? null,
        duration: a.duration ?? null,
        source: a.source ?? null,
        studios: names(a.studios),
        popularity: a.popularity ?? null,
        members: a.members ?? null,
      };
    },
  },
  {
    slug: "top",
    title: "Top Anime",
    description: "Daftar anime teratas (sedang tayang, akan tayang, terpopuler, favorit).",
    params: [
      { name: "filter", type: "enum", values: ["airing", "upcoming", "bypopularity", "favorite"], default: "airing", description: "Jenis peringkat.", example: "airing" },
      LIMIT_PARAM(10, 25),
    ],
    cache: 3600,
    quota: true,
    run: async (ctx) => list(await ctx.json<any>(`${J}/top/anime?filter=${ctx.q.filter}&limit=${ctx.q.limit}&sfw=true`)).map(mapAnime),
  },
  {
    slug: "seasonal",
    title: "Seasonal Anime",
    description: "Anime yang tayang pada musim ini.",
    params: [LIMIT_PARAM(10, 25)],
    cache: 3600,
    quota: true,
    run: async (ctx) => list(await ctx.json<any>(`${J}/seasons/now?limit=${ctx.q.limit}&sfw=true`)).map(mapAnime),
  },
  {
    slug: "schedule",
    title: "Broadcast Schedule",
    description: "Jadwal tayang anime pada hari tertentu.",
    params: [{ name: "day", type: "enum", values: DAYS, default: "monday", description: "Hari tayang.", example: "monday" }, LIMIT_PARAM(10, 25)],
    cache: 3600,
    quota: true,
    run: async (ctx) => list(await ctx.json<any>(`${J}/schedules?filter=${ctx.q.day}&limit=${ctx.q.limit}&sfw=true`)).map(mapAnime),
  },
  {
    slug: "character",
    title: "Search Character",
    description: "Cari karakter anime/manga.",
    params: [{ name: "q", required: true, max: 100, description: "Nama karakter.", example: "luffy" }, LIMIT_PARAM(5, 15)],
    cache: 3600,
    quota: true,
    run: async (ctx) =>
      list(await ctx.json<any>(`${J}/characters?q=${enc(ctx.q.q as string)}&limit=${ctx.q.limit}&order_by=favorites&sort=desc`)).map((c) => ({
        id: c.mal_id,
        name: c.name,
        nameKanji: c.name_kanji ?? null,
        nicknames: c.nicknames ?? [],
        favorites: c.favorites ?? 0,
        about: c.about ? String(c.about).slice(0, 600) : null,
        image: img(c),
        url: c.url ?? null,
      })),
  },
  {
    slug: "manga",
    title: "Search Manga",
    description: "Cari manga berdasarkan judul (konten dewasa disaring).",
    params: [{ name: "q", required: true, max: 100, description: "Judul manga.", example: "one piece" }, LIMIT_PARAM(10, 25)],
    cache: 3600,
    quota: true,
    run: async (ctx) =>
      list(await ctx.json<any>(`${J}/manga?q=${enc(ctx.q.q as string)}&limit=${ctx.q.limit}&sfw=true`)).map((m) => ({
        id: m.mal_id,
        title: m.title,
        type: m.type ?? null,
        chapters: m.chapters ?? null,
        volumes: m.volumes ?? null,
        status: m.status ?? null,
        score: m.score ?? null,
        genres: names(m.genres),
        synopsis: m.synopsis ?? null,
        image: img(m),
        url: m.url ?? null,
      })),
  },
  {
    slug: "random",
    title: "Random Anime",
    description: "Anime acak (selalu disaring dari konten dewasa).",
    cache: 0,
    quota: true,
    run: async (ctx) => {
      for (let i = 0; i < 4; i++) {
        const a = (await ctx.json<any>(`${J}/random/anime`))?.data;
        if (a && !isAdult(a)) return mapAnime(a);
      }
      throw new UpstreamError("no safe result");
    },
  },
  {
    slug: "trending",
    title: "Trending Anime",
    description: "Anime yang sedang trending saat ini (AniList).",
    params: [LIMIT_PARAM(10, 25)],
    cache: 900,
    run: async (ctx) => {
      const query = `query($n:Int){Page(perPage:$n){media(sort:TRENDING_DESC,type:ANIME,isAdult:false){id title{romaji english native} averageScore episodes format status season seasonYear genres coverImage{large} siteUrl trending}}}`;
      const d = await ctx.json<any>("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { n: clamp(Number(ctx.q.limit), 1, 25) } }),
      });
      const media = d?.data?.Page?.media;
      if (!Array.isArray(media)) throw new UpstreamError("bad shape");
      return media.map((m: any) => ({
        id: m.id,
        title: m.title?.english || m.title?.romaji,
        titleRomaji: m.title?.romaji ?? null,
        titleNative: m.title?.native ?? null,
        score: m.averageScore ?? null,
        episodes: m.episodes ?? null,
        format: m.format ?? null,
        status: m.status ?? null,
        season: m.season ? `${m.season} ${m.seasonYear ?? ""}`.trim() : null,
        genres: m.genres ?? [],
        trending: m.trending ?? null,
        image: m.coverImage?.large ?? null,
        url: m.siteUrl ?? null,
      }));
    },
  },
  {
    slug: "image",
    title: "Anime Image",
    description: "Gambar anime acak (SFW) — waifu, neko, hug, pat, dan lainnya.",
    params: [{ name: "type", type: "enum", values: WAIFU_TYPES, default: "waifu", description: "Jenis gambar.", example: "waifu" }],
    cache: 0,
    tags: ["waifu", "neko", "sfw"],
    run: async (ctx) => {
      const type = ctx.q.type as string;
      const waifuPics = async () => {
        const d = await ctx.json<any>(`https://api.waifu.pics/sfw/${enc(type)}`);
        if (typeof d?.url !== "string") throw new UpstreamError("empty");
        return { type, url: d.url as string, source: "waifu.pics" };
      };
      const nekos = async () => {
        const d = await ctx.json<any>(`https://nekos.best/api/v2/${enc(NEKOS_MAP[type] ?? "waifu")}`);
        const r = d?.results?.[0];
        if (typeof r?.url !== "string") throw new UpstreamError("empty");
        return { type, url: r.url as string, source: "nekos.best", artist: r.artist_name ?? null, anime: r.anime_name ?? null };
      };
      return ctx.first(type === "husbando" || type === "kitsune" ? [nekos, waifuPics] : [waifuPics, nekos]);
    },
  },
  {
    slug: "whatanime",
    title: "Find Anime by Screenshot",
    description: "Cari tahu judul anime dari URL gambar screenshot (trace.moe).",
    params: [{ name: "url", type: "url", required: true, description: "URL langsung ke gambar screenshot.", example: "https://i.imgur.com/zLxHIeo.jpg" }],
    cache: 86400,
    cost: 3,
    quota: true,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://api.trace.moe/search?anilistInfo&cutBorders&url=${enc(ctx.q.url as string)}`, { timeout: 15000 });
      if (!Array.isArray(d?.result)) throw new UpstreamError("bad shape");
      return d.result
        .filter((r: any) => !r?.anilist?.isAdult)
        .slice(0, 3)
        .map((r: any) => ({
          anilistId: r.anilist?.id ?? r.anilist ?? null,
          title: r.anilist?.title?.english || r.anilist?.title?.romaji || r.filename || null,
          episode: r.episode ?? null,
          from: r.from ?? null,
          to: r.to ?? null,
          similarity: typeof r.similarity === "number" ? Math.round(r.similarity * 10000) / 100 : null,
          preview: r.image ?? null,
          video: r.video ?? null,
        }));
    },
  },
]);
