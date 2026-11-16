import { group, enc, LIMIT_PARAM } from "../api/define";
import { UpstreamError } from "../api/errors";
import { decodeEntities } from "../api/xml";

const strip = (s: unknown) => decodeEntities(String(s ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const art = (u: unknown, size = 600) => (typeof u === "string" ? u.replace(/\/\d+x\d+(bb)?\./, `/${size}x${size}bb.`) : null);

const oembed = (title: string, slug: string, base: string, example: string, desc: string, extra: Record<string, string> = {}) => ({
  slug,
  title,
  description: desc,
  params: [{ name: "url", type: "url" as const, required: true, description: "URL konten.", example }],
  cache: 3600,
  run: async (ctx: import("../api/types").Ctx) => {
    const d = await ctx.json<any>(`${base}${enc(ctx.q.url as string)}${extra.suffix ?? ""}`);
    if (!d?.title && !d?.html) throw new UpstreamError("bad shape");
    return {
      title: d.title ?? null,
      author: d.author_name ?? null,
      authorUrl: d.author_url ?? null,
      thumbnail: d.thumbnail_url ?? null,
      provider: d.provider_name ?? null,
      width: d.width ?? null,
      height: d.height ?? null,
      embedHtml: d.html ?? null,
    };
  },
});

export default group("media", [
  oembed("YouTube Video Info", "youtube-info", "https://www.youtube.com/oembed?format=json&url=", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Judul, channel & thumbnail video YouTube dari URL (oEmbed)."),
  oembed("Spotify Info", "spotify-info", "https://open.spotify.com/oembed?url=", "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "Info track/album/playlist Spotify dari URL (oEmbed)."),
  oembed("TikTok Video Info", "tiktok-info", "https://www.tiktok.com/oembed?url=", "https://www.tiktok.com/@scout2015/video/6718335390845095173", "Info video TikTok dari URL (oEmbed)."),
  {
    slug: "music",
    title: "Search Music",
    description: "Cari lagu (artis, album, preview 30 detik) via iTunes dengan fallback Deezer.",
    params: [{ name: "q", required: true, max: 100, description: "Judul lagu / artis.", example: "coldplay yellow" }, LIMIT_PARAM(10, 25)],
    cache: 3600,
    run: async (ctx) => {
      const q = enc(ctx.q.q as string);
      const n = Number(ctx.q.limit);
      return ctx.first([
        async () => {
          const d = await ctx.json<any>(`https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=${n}`);
          if (!Array.isArray(d?.results) || d.results.length === 0) throw new UpstreamError("empty", 404);
          return d.results.map((r: any) => ({ id: r.trackId, title: r.trackName, artist: r.artistName, album: r.collectionName ?? null, genre: r.primaryGenreName ?? null, releaseDate: r.releaseDate ?? null, durationMs: r.trackTimeMillis ?? null, cover: art(r.artworkUrl100), preview: r.previewUrl ?? null, url: r.trackViewUrl ?? null, source: "itunes" }));
        },
        async () => {
          const d = await ctx.json<any>(`https://api.deezer.com/search?q=${q}&limit=${n}`);
          if (!Array.isArray(d?.data) || d.data.length === 0) throw new UpstreamError("empty", 404);
          return d.data.map((r: any) => ({ id: r.id, title: r.title, artist: r.artist?.name ?? null, album: r.album?.title ?? null, genre: null, releaseDate: null, durationMs: (r.duration ?? 0) * 1000, cover: r.album?.cover_big ?? null, preview: r.preview ?? null, url: r.link ?? null, source: "deezer" }));
        },
      ]);
    },
  },
  {
    slug: "movie",
    title: "Search Movie",
    description: "Cari film (sinopsis, genre, trailer) via iTunes.",
    params: [{ name: "q", required: true, max: 100, description: "Judul film.", example: "inception" }, LIMIT_PARAM(8, 20)],
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://itunes.apple.com/search?term=${enc(ctx.q.q as string)}&media=movie&entity=movie&limit=${ctx.q.limit}`);
      if (!Array.isArray(d?.results)) throw new UpstreamError("bad shape");
      return d.results.map((r: any) => ({ id: r.trackId, title: r.trackName, director: r.artistName ?? null, genre: r.primaryGenreName ?? null, releaseDate: r.releaseDate ?? null, rating: r.contentAdvisoryRating ?? null, description: r.longDescription ?? r.shortDescription ?? null, poster: art(r.artworkUrl100, 600), trailer: r.previewUrl ?? null, url: r.trackViewUrl ?? null }));
    },
  },
  {
    slug: "tv",
    title: "Search TV Show",
    description: "Cari serial TV (rating, jaringan, status, sinopsis) via TVMaze.",
    params: [{ name: "q", required: true, max: 100, description: "Judul serial.", example: "breaking bad" }, LIMIT_PARAM(8, 20)],
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any[]>(`https://api.tvmaze.com/search/shows?q=${enc(ctx.q.q as string)}`);
      if (!Array.isArray(d)) throw new UpstreamError("bad shape");
      return d.slice(0, Number(ctx.q.limit)).map(({ show: s }) => ({ id: s.id, name: s.name, type: s.type ?? null, language: s.language ?? null, genres: s.genres ?? [], status: s.status ?? null, premiered: s.premiered ?? null, rating: s.rating?.average ?? null, network: s.network?.name ?? s.webChannel?.name ?? null, summary: strip(s.summary) || null, poster: s.image?.original ?? null, url: s.url ?? null }));
    },
  },
  {
    slug: "book",
    title: "Search Book",
    description: "Cari buku (penulis, tahun terbit, cover) via Open Library.",
    params: [{ name: "q", required: true, max: 100, description: "Judul / penulis.", example: "laskar pelangi" }, LIMIT_PARAM(8, 20)],
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://openlibrary.org/search.json?q=${enc(ctx.q.q as string)}&limit=${ctx.q.limit}&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject`);
      if (!Array.isArray(d?.docs)) throw new UpstreamError("bad shape");
      return d.docs.map((b: any) => ({ title: b.title, authors: b.author_name ?? [], firstPublishYear: b.first_publish_year ?? null, pages: b.number_of_pages_median ?? null, subjects: (b.subject ?? []).slice(0, 5), cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null, url: `https://openlibrary.org${b.key}` }));
    },
  },
  {
    slug: "artwork",
    title: "Search Artwork",
    description: "Cari karya seni museum (Art Institute of Chicago) beserta gambarnya.",
    params: [{ name: "q", required: true, max: 100, description: "Kata kunci.", example: "monet" }, LIMIT_PARAM(8, 20)],
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://api.artic.edu/api/v1/artworks/search?q=${enc(ctx.q.q as string)}&limit=${ctx.q.limit}&fields=id,title,artist_display,date_display,medium_display,image_id`);
      if (!Array.isArray(d?.data)) throw new UpstreamError("bad shape");
      return d.data.map((a: any) => ({ id: a.id, title: a.title, artist: a.artist_display ?? null, date: a.date_display ?? null, medium: a.medium_display ?? null, image: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg` : null, url: `https://www.artic.edu/artworks/${a.id}` }));
    },
  },
  {
    slug: "photo",
    title: "Random Photo",
    description: "URL foto acak berkualitas (Picsum). Pakai seed agar foto sama setiap kali.",
    params: [
      { name: "width", type: "number", default: 800, min: 100, max: 3000, description: "Lebar (px).", example: 800 },
      { name: "height", type: "number", default: 600, min: 100, max: 3000, description: "Tinggi (px).", example: 600 },
      { name: "seed", max: 60, pattern: /^[A-Za-z0-9_-]+$/, patternHint: "letters, numbers, - _", description: "Seed (opsional).", example: "wanspace" },
    ],
    cache: (q) => (q.seed ? 86400 : 0),
    run: async (ctx) => {
      const w = Math.round(Number(ctx.q.width));
      const h = Math.round(Number(ctx.q.height));
      const seed = (ctx.q.seed as string | undefined) ?? Math.random().toString(36).slice(2, 10);
      return { width: w, height: h, seed, url: `https://picsum.photos/seed/${enc(seed)}/${w}/${h}` };
    },
  },
]);
