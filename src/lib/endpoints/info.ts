import { group, enc, LIMIT_PARAM } from "../api/define";
import { UpstreamError } from "../api/errors";
import { geocode } from "../api/geo";

const aqiLabel = (v: number) => (v <= 50 ? "Good" : v <= 100 ? "Moderate" : v <= 150 ? "Unhealthy for sensitive groups" : v <= 200 ? "Unhealthy" : v <= 300 ? "Very unhealthy" : "Hazardous");
const quakeFromUsgs = (f: any) => ({
  time: f.properties?.time ? new Date(f.properties.time).toISOString() : null,
  magnitude: f.properties?.mag ?? null,
  depth: f.geometry?.coordinates?.[2] != null ? `${Math.round(f.geometry.coordinates[2])} km` : null,
  latitude: f.geometry?.coordinates?.[1] ?? null,
  longitude: f.geometry?.coordinates?.[0] ?? null,
  region: f.properties?.place ?? null,
  tsunami: Boolean(f.properties?.tsunami),
  url: f.properties?.url ?? null,
});

const bmkg = (g: any) => {
  const [lat, lon] = String(g.Coordinates ?? ",").split(",").map(Number);
  return {
    time: g.DateTime ?? null,
    date: g.Tanggal ?? null,
    hour: g.Jam ?? null,
    magnitude: Number(g.Magnitude) || null,
    depth: g.Kedalaman ?? null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    region: g.Wilayah ?? null,
    potential: g.Potensi ?? null,
    felt: g.Dirasakan ?? null,
    shakemap: g.Shakemap ? `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}` : null,
    source: "BMKG",
  };
};

const BMKG_FILES = { latest: "autogempa.json", recent: "gempaterkini.json", felt: "gempadirasakan.json" } as const;

export default group("info", [
  {
    slug: "gempa",
    title: "Gempa Indonesia",
    description: "Info gempa terbaru di Indonesia dari BMKG (fallback USGS). Tipe: latest, recent (M5+), felt (dirasakan).",
    params: [{ name: "type", type: "enum", values: ["latest", "recent", "felt"], default: "latest", description: "Jenis data.", example: "latest" }],
    cache: 60,
    tags: ["bmkg", "gempa", "earthquake"],
    run: async (ctx) => {
      const type = ctx.q.type as keyof typeof BMKG_FILES;
      return ctx.first([
        async () => {
          const d = await ctx.json<any>(`https://data.bmkg.go.id/DataMKG/TEWS/${BMKG_FILES[type]}`);
          const g = d?.Infogempa?.gempa;
          if (!g) throw new UpstreamError("bad shape");
          return type === "latest" ? [bmkg(g)] : (Array.isArray(g) ? g : [g]).map(bmkg);
        },
        async () => {
          const d = await ctx.json<any>("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&minmagnitude=4&limit=15&orderby=time");
          if (!Array.isArray(d?.features) || d.features.length === 0) throw new UpstreamError("empty");
          const list = d.features.map((f: any) => ({ ...quakeFromUsgs(f), source: "USGS" }));
          return type === "latest" ? list.slice(0, 1) : list;
        },
      ]);
    },
  },
  {
    slug: "quake-world",
    title: "Earthquakes Worldwide",
    description: "Gempa di seluruh dunia dari USGS.",
    params: [
      { name: "magnitude", type: "enum", values: ["significant", "4.5", "2.5", "1.0"], default: "4.5", description: "Minimum magnitudo.", example: "4.5" },
      { name: "period", type: "enum", values: ["hour", "day", "week", "month"], default: "day", description: "Rentang waktu.", example: "day" },
      LIMIT_PARAM(10, 50),
    ],
    cache: 120,
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${ctx.q.magnitude}_${ctx.q.period}.geojson`);
      if (!Array.isArray(d?.features)) throw new UpstreamError("bad shape");
      return { count: d.metadata?.count ?? d.features.length, quakes: d.features.slice(0, Number(ctx.q.limit)).map(quakeFromUsgs) };
    },
  },
  {
    slug: "country",
    title: "Country Info",
    description: "Data negara: ibu kota, populasi, bahasa, mata uang, bendera, zona waktu.",
    params: [{ name: "name", required: true, max: 60, pattern: /^[\p{L} .'-]+$/u, patternHint: "country name", description: "Nama negara.", example: "indonesia" }],
    cache: 86400,
    run: async (ctx) => {
      const d = await ctx.json<any[]>(`https://restcountries.com/v3.1/name/${enc(ctx.q.name as string)}?fields=name,capital,region,subregion,population,area,languages,currencies,flags,timezones`);
      const c = Array.isArray(d) ? d[0] : null;
      if (!c) throw new UpstreamError("not found", 404);
      return {
        name: c.name?.common,
        officialName: c.name?.official,
        capital: c.capital ?? [],
        region: c.region ?? null,
        subregion: c.subregion ?? null,
        population: c.population ?? null,
        areaKm2: c.area ?? null,
        languages: Object.values(c.languages ?? {}),
        currencies: Object.entries(c.currencies ?? {}).map(([code, v]: [string, any]) => ({ code, name: v?.name, symbol: v?.symbol })),
        timezones: c.timezones ?? [],
        flag: c.flags?.png ?? null,
      };
    },
  },
  {
    slug: "holidays",
    title: "Public Holidays",
    description: "Hari libur nasional suatu negara pada tahun tertentu (Nager.Date).",
    params: [
      { name: "country", default: "ID", max: 2, pattern: /^[A-Za-z]{2}$/, patternHint: "2-letter ISO code like ID, US", description: "Kode negara ISO.", example: "ID" },
      { name: "year", type: "number", min: 1990, max: 2100, description: "Tahun (default tahun ini).", example: 2026 },
    ],
    cache: 86400,
    run: async (ctx) => {
      const cc = (ctx.q.country as string).toUpperCase();
      const year = Math.round(Number(ctx.q.year ?? new Date().getUTCFullYear()));
      const d = await ctx.json<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
      if (!Array.isArray(d)) throw new UpstreamError("bad shape");
      return { country: cc, year, holidays: d.map((h) => ({ date: h.date, name: h.name, localName: h.localName, global: Boolean(h.global), types: h.types ?? [] })) };
    },
  },
  {
    slug: "iss",
    title: "ISS Location",
    description: "Posisi Stasiun Luar Angkasa Internasional (ISS) secara real-time.",
    cache: 5,
    run: async (ctx) => {
      const d = await ctx.json<any>("https://api.wheretheiss.at/v1/satellites/25544");
      if (typeof d?.latitude !== "number") throw new UpstreamError("bad shape");
      return { latitude: d.latitude, longitude: d.longitude, altitudeKm: Math.round(d.altitude * 100) / 100, velocityKmh: Math.round(d.velocity), visibility: d.visibility ?? null, timestamp: d.timestamp ? new Date(d.timestamp * 1000).toISOString() : null };
    },
  },
  {
    slug: "wikipedia",
    title: "Wikipedia Summary",
    description: "Ringkasan artikel Wikipedia dari kata kunci pencarian.",
    params: [
      { name: "q", required: true, max: 100, description: "Kata kunci.", example: "Candi Borobudur" },
      { name: "lang", type: "enum", values: ["id", "en"], default: "id", description: "Bahasa Wikipedia.", example: "id" },
    ],
    cache: 21600,
    run: async (ctx) => {
      const lang = ctx.q.lang as string;
      const s = await ctx.json<any>(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(ctx.q.q as string)}&srlimit=1&format=json&utf8=1`);
      const title = s?.query?.search?.[0]?.title;
      if (typeof title !== "string") throw new UpstreamError("not found", 404);
      const d = await ctx.json<any>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${enc(title.replace(/ /g, "_"))}`);
      return { title: d.title, description: d.description ?? null, extract: d.extract ?? null, thumbnail: d.thumbnail?.source ?? null, url: d.content_urls?.desktop?.page ?? null, lang };
    },
  },
  {
    slug: "dictionary",
    title: "English Dictionary",
    description: "Definisi, fonetik, dan contoh kalimat kata bahasa Inggris.",
    params: [{ name: "word", required: true, max: 40, pattern: /^[A-Za-z' -]+$/, patternHint: "an English word", description: "Kata.", example: "serendipity" }],
    cache: 86400,
    run: async (ctx) => {
      const d = await ctx.json<any[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(ctx.q.word as string)}`);
      const e = Array.isArray(d) ? d[0] : null;
      if (!e?.word) throw new UpstreamError("not found", 404);
      return {
        word: e.word,
        phonetic: e.phonetic ?? e.phonetics?.find((p: any) => p.text)?.text ?? null,
        audio: e.phonetics?.find((p: any) => p.audio)?.audio ?? null,
        meanings: (e.meanings ?? []).map((m: any) => ({ partOfSpeech: m.partOfSpeech, definitions: (m.definitions ?? []).slice(0, 3).map((x: any) => ({ definition: x.definition, example: x.example ?? null })) })),
      };
    },
  },
  {
    slug: "github-user",
    title: "GitHub User",
    description: "Profil publik pengguna GitHub.",
    params: [{ name: "username", required: true, max: 39, pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, patternHint: "a GitHub username", description: "Username GitHub.", example: "torvalds" }],
    cache: 900,
    quota: true,
    run: async (ctx) => {
      const u = await ctx.json<any>(`https://api.github.com/users/${enc(ctx.q.username as string)}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!u?.login) throw new UpstreamError("bad shape");
      return { login: u.login, name: u.name ?? null, bio: u.bio ?? null, avatar: u.avatar_url, company: u.company ?? null, location: u.location ?? null, blog: u.blog || null, followers: u.followers, following: u.following, publicRepos: u.public_repos, createdAt: u.created_at, url: u.html_url };
    },
  },
  {
    slug: "github-repo",
    title: "GitHub Repository",
    description: "Statistik repository GitHub (bintang, fork, bahasa, lisensi).",
    params: [{ name: "repo", required: true, max: 201, pattern: /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/, patternHint: "owner/name like vercel/next.js", description: "owner/nama.", example: "vercel/next.js" }],
    cache: 900,
    quota: true,
    run: async (ctx) => {
      const path = (ctx.q.repo as string).split("/").map(enc).join("/");
      const r = await ctx.json<any>(`https://api.github.com/repos/${path}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!r?.full_name) throw new UpstreamError("bad shape");
      return { fullName: r.full_name, description: r.description ?? null, stars: r.stargazers_count, forks: r.forks_count, openIssues: r.open_issues_count, language: r.language ?? null, license: r.license?.spdx_id ?? null, topics: r.topics ?? [], defaultBranch: r.default_branch, archived: Boolean(r.archived), homepage: r.homepage || null, createdAt: r.created_at, pushedAt: r.pushed_at, url: r.html_url };
    },
  },
  {
    slug: "npm",
    title: "npm Package",
    description: "Info paket npm: versi terbaru, deskripsi, lisensi, dan unduhan mingguan.",
    params: [{ name: "package", required: true, max: 214, pattern: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, patternHint: "a valid npm package name", description: "Nama paket.", example: "next" }],
    cache: 1800,
    run: async (ctx) => {
      const name = ctx.q.package as string;
      const [p, dl] = await Promise.all([
        ctx.json<any>(`https://registry.npmjs.org/${name.replace("/", "%2f")}/latest`),
        ctx.json<any>(`https://api.npmjs.org/downloads/point/last-week/${name}`).catch(() => null),
      ]);
      if (!p?.name) throw new UpstreamError("bad shape");
      return { name: p.name, version: p.version, description: p.description ?? null, license: typeof p.license === "string" ? p.license : null, homepage: p.homepage ?? null, keywords: p.keywords ?? [], dependencies: Object.keys(p.dependencies ?? {}).length, weeklyDownloads: dl?.downloads ?? null, url: `https://www.npmjs.com/package/${name}` };
    },
  },
  {
    slug: "air-quality",
    title: "Air Quality",
    description: "Kualitas udara (US AQI, PM2.5, PM10, dll.) untuk kota mana pun.",
    params: [{ name: "city", required: true, max: 80, description: "Nama kota.", example: "Jakarta" }],
    cache: 900,
    run: async (ctx) => {
      const place = await geocode(ctx, ctx.q.city as string);
      const d = await ctx.json<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`);
      const c = d?.current;
      if (!c || typeof c.us_aqi !== "number") throw new UpstreamError("bad shape");
      return { location: place, aqi: c.us_aqi, category: aqiLabel(c.us_aqi), pm25: c.pm2_5, pm10: c.pm10, co: c.carbon_monoxide, no2: c.nitrogen_dioxide, o3: c.ozone, time: c.time, units: d.current_units ?? null };
    },
  },
]);
