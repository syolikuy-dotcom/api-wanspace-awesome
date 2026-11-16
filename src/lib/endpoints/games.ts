import { group, enc, shuffle, LIMIT_PARAM } from "../api/define";
import { UpstreamError } from "../api/errors";

const PLATFORMS = ["pc", "steam", "epic-games-store", "ubisoft", "gog", "itchio", "ps4", "ps5", "xbox-one", "xbox-series-xs", "switch", "android", "ios"] as const;

export default group("games", [
  {
    slug: "pokemon",
    title: "Pokémon",
    description: "Data Pokémon (tipe, kemampuan, stat, gambar) berdasarkan nama atau nomor Pokédex.",
    params: [{ name: "name", required: true, max: 40, pattern: /^[A-Za-z0-9 .'-]+$/, patternHint: "pokemon name or number", description: "Nama atau nomor.", example: "pikachu" }],
    cache: 86400,
    quota: true,
    run: async (ctx) => {
      const name = (ctx.q.name as string).toLowerCase().replace(/[ .']+/g, "-");
      const p = await ctx.json<any>(`https://pokeapi.co/api/v2/pokemon/${enc(name)}`);
      if (!p?.id) throw new UpstreamError("bad shape");
      return {
        id: p.id,
        name: p.name,
        height: p.height / 10,
        weight: p.weight / 10,
        baseExperience: p.base_experience ?? null,
        types: (p.types ?? []).map((t: any) => t.type?.name),
        abilities: (p.abilities ?? []).map((a: any) => ({ name: a.ability?.name, hidden: Boolean(a.is_hidden) })),
        stats: Object.fromEntries((p.stats ?? []).map((s: any) => [s.stat?.name, s.base_stat])),
        image: p.sprites?.other?.["official-artwork"]?.front_default ?? p.sprites?.front_default ?? null,
        units: { height: "m", weight: "kg" },
      };
    },
  },
  {
    slug: "free-games",
    title: "Free-to-Play Games",
    description: "Daftar game free-to-play (PC/browser) lengkap dengan genre & link (FreeToGame).",
    params: [
      { name: "platform", type: "enum", values: ["all", "pc", "browser"], default: "pc", description: "Platform.", example: "pc" },
      { name: "category", max: 30, pattern: /^[a-z0-9.-]+$/i, patternHint: "genre like shooter, mmorpg, moba", description: "Genre (opsional).", example: "shooter" },
      LIMIT_PARAM(10, 30),
    ],
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any[]>(`https://www.freetogame.com/api/games?platform=${ctx.q.platform}${ctx.q.category ? `&category=${enc(ctx.q.category as string)}` : ""}`, { maxBytes: 4_000_000 });
      if (!Array.isArray(d)) throw new UpstreamError("bad shape");
      return d.slice(0, Number(ctx.q.limit)).map((g) => ({ id: g.id, title: g.title, genre: g.genre, platform: g.platform, publisher: g.publisher, developer: g.developer, releaseDate: g.release_date, description: g.short_description, thumbnail: g.thumbnail, url: g.game_url, profile: g.freetogame_profile_url }));
    },
  },
  {
    slug: "giveaways",
    title: "Game Giveaways",
    description: "Game & loot gratis yang sedang dibagikan (Steam, Epic, GOG, dan lainnya) via GamerPower.",
    params: [
      { name: "type", type: "enum", values: ["game", "loot", "beta"], default: "game", description: "Jenis giveaway.", example: "game" },
      { name: "platform", type: "enum", values: PLATFORMS, default: "pc", description: "Platform.", example: "pc" },
      LIMIT_PARAM(10, 30),
    ],
    cache: 900,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://www.gamerpower.com/api/giveaways?platform=${ctx.q.platform}&type=${ctx.q.type}`);
      const arr = Array.isArray(d) ? d : [];
      return arr.slice(0, Number(ctx.q.limit)).map((g) => ({ id: g.id, title: g.title, worth: g.worth, description: g.description, instructions: g.instructions, platforms: g.platforms, type: g.type, endDate: g.end_date === "N/A" ? null : g.end_date, image: g.image, url: g.open_giveaway_url }));
    },
  },
  {
    slug: "deals",
    title: "Game Deals",
    description: "Diskon game PC terbaik dari berbagai toko (CheapShark).",
    params: [
      { name: "maxPrice", type: "number", default: 15, min: 0, max: 100, description: "Harga maksimum (USD).", example: 15 },
      { name: "store", type: "number", default: 1, min: 1, max: 40, description: "ID toko (1 = Steam, 25 = Epic).", example: 1 },
      LIMIT_PARAM(10, 30),
    ],
    cache: 900,
    run: async (ctx) => {
      const d = await ctx.json<any[]>(`https://www.cheapshark.com/api/1.0/deals?storeID=${Math.round(Number(ctx.q.store))}&upperPrice=${Number(ctx.q.maxPrice)}&pageSize=${ctx.q.limit}&sortBy=Savings`);
      if (!Array.isArray(d)) throw new UpstreamError("bad shape");
      return d.map((x) => ({ title: x.title, salePrice: Number(x.salePrice), normalPrice: Number(x.normalPrice), savings: Math.round(Number(x.savings)), metacritic: Number(x.metacriticScore) || null, steamRating: x.steamRatingText ?? null, thumbnail: x.thumb, url: `https://www.cheapshark.com/redirect?dealID=${enc(x.dealID)}` }));
    },
  },
  {
    slug: "trivia",
    title: "Trivia Questions",
    description: "Soal trivia pilihan ganda acak (Open Trivia DB).",
    params: [
      { name: "amount", type: "number", default: 5, min: 1, max: 10, description: "Jumlah soal.", example: 3 },
      { name: "difficulty", type: "enum", values: ["any", "easy", "medium", "hard"], default: "any", description: "Tingkat kesulitan.", example: "easy" },
      { name: "category", type: "number", min: 9, max: 32, description: "ID kategori OpenTDB (9–32), opsional.", example: 9 },
    ],
    cache: 20,
    quota: true,
    run: async (ctx) => {
      const url = `https://opentdb.com/api.php?amount=${Math.round(Number(ctx.q.amount))}&type=multiple&encode=url3986${ctx.q.difficulty !== "any" ? `&difficulty=${ctx.q.difficulty}` : ""}${ctx.q.category ? `&category=${Math.round(Number(ctx.q.category))}` : ""}`;
      const d = await ctx.json<any>(url);
      if (d?.response_code !== 0 || !Array.isArray(d.results)) throw new UpstreamError("busy", d?.response_code === 5 ? 429 : 0);
      const dec = (s: string) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      };
      return d.results.map((r: any) => ({ category: dec(r.category), difficulty: r.difficulty, question: dec(r.question), correctAnswer: dec(r.correct_answer), options: shuffle([r.correct_answer, ...r.incorrect_answers].map(dec)) }));
    },
  },
  {
    slug: "minecraft",
    title: "Minecraft Server Status",
    description: "Status server Minecraft Java/Bedrock: online, pemain, versi, MOTD.",
    params: [{ name: "host", required: true, max: 260, pattern: /^[a-z0-9.-]{3,253}(:\d{1,5})?$/i, patternHint: "hostname or hostname:port", description: "Alamat server.", example: "mc.hypixel.net" }],
    cache: 60,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://api.mcsrvstat.us/3/${enc(ctx.q.host as string)}`);
      if (typeof d?.online !== "boolean") throw new UpstreamError("bad shape");
      return { host: ctx.q.host, online: d.online, ip: d.ip ?? null, port: d.port ?? null, version: d.version ?? null, motd: d.motd?.clean ?? [], players: d.players ? { online: d.players.online, max: d.players.max } : null };
    },
  },
  {
    slug: "chess-puzzle",
    title: "Daily Chess Puzzle",
    description: "Puzzle catur harian dari Lichess (PGN, tema, solusi).",
    cache: 3600,
    run: async (ctx) => {
      const d = await ctx.json<any>("https://lichess.org/api/puzzle/daily");
      const p = d?.puzzle;
      if (!p?.id) throw new UpstreamError("bad shape");
      return { id: p.id, rating: p.rating, plays: p.plays ?? null, themes: p.themes ?? [], solution: p.solution ?? [], initialPly: p.initialPly ?? null, pgn: d.game?.pgn ?? null, url: `https://lichess.org/training/${p.id}` };
    },
  },
  {
    slug: "lichess-user",
    title: "Lichess Profile",
    description: "Profil & rating pemain Lichess.",
    params: [{ name: "username", required: true, max: 30, pattern: /^[A-Za-z0-9_-]{2,30}$/, patternHint: "2–30 letters, numbers, - _", description: "Username Lichess.", example: "DrNykterstein" }],
    cache: 900,
    quota: true,
    run: async (ctx) => {
      const u = await ctx.json<any>(`https://lichess.org/api/user/${enc(ctx.q.username as string)}`);
      if (!u?.id) throw new UpstreamError("bad shape");
      const r = (k: string) => u.perfs?.[k]?.rating ?? null;
      return { username: u.username, title: u.title ?? null, online: Boolean(u.online), ratings: { bullet: r("bullet"), blitz: r("blitz"), rapid: r("rapid"), classical: r("classical") }, games: { total: u.count?.all ?? 0, wins: u.count?.win ?? 0, losses: u.count?.loss ?? 0, draws: u.count?.draw ?? 0 }, createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null, url: u.url ?? `https://lichess.org/@/${u.username}` };
    },
  },
]);
