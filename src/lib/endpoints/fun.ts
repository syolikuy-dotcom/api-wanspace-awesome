import { randomInt } from "node:crypto";
import { group } from "../api/define";
import { ApiError, UpstreamError } from "../api/errors";

const EIGHT = ["It is certain.", "Without a doubt.", "Yes — definitely.", "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.", "Better not tell you now.", "Cannot predict now.", "Don't count on it.", "My reply is no.", "My sources say no.", "Outlook not so good.", "Very doubtful."];

export default group("fun", [
  {
    slug: "joke",
    title: "Random Joke",
    description: "Joke acak (aman untuk semua umur).",
    cache: 0,
    run: async (ctx) =>
      ctx.first([
        async () => {
          const d = await ctx.json<any>("https://v2.jokeapi.dev/joke/Any?safe-mode&blacklistFlags=nsfw,religious,political,racist,sexist,explicit");
          if (d?.error) throw new UpstreamError("error");
          if (d?.type === "single" && d.joke) return { category: d.category, joke: d.joke as string };
          if (d?.setup && d?.delivery) return { category: d.category, setup: d.setup as string, punchline: d.delivery as string };
          throw new UpstreamError("bad shape");
        },
        async () => {
          const d = await ctx.json<any>("https://official-joke-api.appspot.com/random_joke");
          if (!d?.setup || !d?.punchline) throw new UpstreamError("bad shape");
          return { category: d.type ?? "general", setup: d.setup as string, punchline: d.punchline as string };
        },
      ]),
  },
  {
    slug: "quote",
    title: "Random Quote",
    description: "Kutipan inspiratif acak.",
    cache: 0,
    run: async (ctx) =>
      ctx.first([
        async () => {
          const d = await ctx.json<any>("https://dummyjson.com/quotes/random");
          if (!d?.quote) throw new UpstreamError("bad shape");
          return { quote: d.quote as string, author: d.author as string };
        },
        async () => {
          const d = await ctx.json<any>("https://zenquotes.io/api/random");
          const q = Array.isArray(d) ? d[0] : null;
          if (!q?.q) throw new UpstreamError("bad shape");
          return { quote: q.q as string, author: q.a as string };
        },
      ]),
  },
  {
    slug: "fact",
    title: "Random Fact",
    description: "Fakta unik acak.",
    cache: 0,
    run: async (ctx) =>
      ctx.first([
        async () => {
          const d = await ctx.json<any>("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
          if (!d?.text) throw new UpstreamError("bad shape");
          return { fact: d.text as string, source: d.source ?? null };
        },
        async () => {
          const d = await ctx.json<any>("https://catfact.ninja/fact");
          if (!d?.fact) throw new UpstreamError("bad shape");
          return { fact: d.fact as string, source: "catfact.ninja" };
        },
      ]),
  },
  {
    slug: "advice",
    title: "Random Advice",
    description: "Nasihat singkat acak.",
    cache: 0,
    run: async (ctx) => {
      const d = await ctx.json<any>("https://api.adviceslip.com/advice");
      const a = d?.slip?.advice;
      if (!a) throw new UpstreamError("bad shape");
      return { id: d.slip.id, advice: a as string };
    },
  },
  {
    slug: "dog",
    title: "Random Dog",
    description: "Foto anjing acak.",
    cache: 0,
    run: async (ctx) => {
      const d = await ctx.json<any>("https://dog.ceo/api/breeds/image/random");
      if (d?.status !== "success" || typeof d.message !== "string") throw new UpstreamError("bad shape");
      return { url: d.message as string, breed: d.message.match(/breeds\/([^/]+)/)?.[1]?.replace(/-/g, " ") ?? null };
    },
  },
  {
    slug: "cat",
    title: "Random Cat",
    description: "Foto kucing acak.",
    cache: 0,
    run: async (ctx) =>
      ctx.first([
        async () => {
          const d = await ctx.json<any>("https://api.thecatapi.com/v1/images/search");
          const c = Array.isArray(d) ? d[0] : null;
          if (!c?.url) throw new UpstreamError("bad shape");
          return { url: c.url as string, width: c.width ?? null, height: c.height ?? null };
        },
        async () => {
          const d = await ctx.json<any>("https://cataas.com/cat?json=true");
          const url = typeof d?.url === "string" ? d.url : d?.id || d?._id ? `https://cataas.com/cat/${d.id ?? d._id}` : null;
          if (!url) throw new UpstreamError("bad shape");
          return { url, width: null, height: null };
        },
      ]),
  },
  {
    slug: "fox",
    title: "Random Fox",
    description: "Foto rubah acak.",
    cache: 0,
    run: async (ctx) => {
      const d = await ctx.json<any>("https://randomfox.ca/floof/");
      if (typeof d?.image !== "string") throw new UpstreamError("bad shape");
      return { url: d.image as string, link: d.link ?? null };
    },
  },
  {
    slug: "meme",
    title: "Random Meme",
    description: "Meme acak (NSFW & spoiler disaring).",
    cache: 0,
    run: async (ctx) =>
      ctx.first([
        async () => {
          for (let i = 0; i < 3; i++) {
            const d = await ctx.json<any>("https://meme-api.com/gimme");
            if (d?.url && !d.nsfw && !d.spoiler) return { title: d.title, url: d.url as string, subreddit: d.subreddit ?? null, postLink: d.postLink ?? null, upvotes: d.ups ?? null };
          }
          throw new UpstreamError("no safe meme");
        },
        async () => {
          const d = await ctx.json<any>("https://api.imgflip.com/get_memes");
          const memes = d?.data?.memes;
          if (!Array.isArray(memes) || memes.length === 0) throw new UpstreamError("bad shape");
          const m = memes[randomInt(memes.length)];
          return { title: m.name, url: m.url as string, subreddit: null, postLink: null, upvotes: null };
        },
      ]),
  },
  {
    slug: "8ball",
    title: "Magic 8-Ball",
    description: "Tanyakan sesuatu ke bola ajaib 8.",
    params: [{ name: "question", max: 200, description: "Pertanyaan (opsional).", example: "Apakah hari ini hari baik?" }],
    cache: 0,
    run: async (ctx) => ({ question: (ctx.q.question as string | undefined) ?? null, answer: EIGHT[randomInt(EIGHT.length)] }),
  },
  {
    slug: "random",
    title: "Random Generator",
    description: "Angka acak, lempar dadu, lempar koin, atau pilih acak dari daftar (dipisah koma).",
    params: [
      { name: "type", type: "enum", values: ["number", "dice", "coin", "pick"], default: "number", description: "Jenis.", example: "number" },
      { name: "min", type: "number", default: 1, min: -1_000_000_000, max: 1_000_000_000, description: "Minimum (number).", example: 1 },
      { name: "max", type: "number", default: 100, min: -1_000_000_000, max: 1_000_000_000, description: "Maksimum (number).", example: 100 },
      { name: "sides", type: "number", default: 6, min: 2, max: 1000, description: "Sisi dadu (dice).", example: 6 },
      { name: "items", max: 500, description: "Daftar pilihan dipisah koma (pick).", example: "nasi,mie,roti" },
    ],
    cache: 0,
    run: async (ctx) => {
      switch (ctx.q.type) {
        case "dice":
          return { type: "dice", sides: Number(ctx.q.sides), result: randomInt(1, Math.round(Number(ctx.q.sides)) + 1) };
        case "coin":
          return { type: "coin", result: randomInt(2) === 0 ? "heads" : "tails" };
        case "pick": {
          const items = String(ctx.q.items ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          if (items.length < 2) throw new ApiError(400, "invalid_parameter", "Provide at least two comma-separated items.");
          return { type: "pick", items, result: items[randomInt(items.length)] };
        }
        default: {
          const lo = Math.round(Number(ctx.q.min));
          const hi = Math.round(Number(ctx.q.max));
          if (lo > hi || hi - lo >= 2 ** 47) throw new ApiError(400, "invalid_parameter", "'min' must be <= 'max'.");
          return { type: "number", min: lo, max: hi, result: randomInt(lo, hi + 1) };
        }
      }
    },
  },
]);
