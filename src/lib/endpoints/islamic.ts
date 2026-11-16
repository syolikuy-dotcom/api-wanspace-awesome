import { group, enc } from "../api/define";
import { ApiError, UpstreamError } from "../api/errors";

const clean = (t: unknown) => String(t ?? "").replace(/\s*\(.*\)\s*$/, "").trim();

export default group("islamic", [
  {
    slug: "prayer",
    title: "Prayer Times",
    description: "Jadwal sholat hari ini untuk kota mana pun (metode Kemenag RI secara default).",
    params: [
      { name: "city", required: true, max: 80, description: "Nama kota.", example: "Jakarta" },
      { name: "country", default: "Indonesia", max: 60, description: "Nama negara.", example: "Indonesia" },
      { name: "method", type: "number", default: 20, min: 0, max: 23, description: "Metode hitung (20 = Kemenag RI).", example: 20 },
    ],
    cache: 1800,
    tags: ["sholat", "adzan", "jadwal"],
    run: async (ctx) => {
      const d = await ctx.json<any>(`https://api.aladhan.com/v1/timingsByCity?city=${enc(ctx.q.city as string)}&country=${enc(ctx.q.country as string)}&method=${Math.round(Number(ctx.q.method))}`);
      const t = d?.data?.timings;
      if (!t) throw new UpstreamError("bad shape");
      const h = d.data.date?.hijri;
      return {
        city: ctx.q.city,
        country: ctx.q.country,
        date: d.data.date?.gregorian?.date ?? null,
        hijri: h ? `${h.day} ${h.month?.en} ${h.year}` : null,
        timings: { imsak: clean(t.Imsak), subuh: clean(t.Fajr), terbit: clean(t.Sunrise), dzuhur: clean(t.Dhuhr), ashar: clean(t.Asr), maghrib: clean(t.Maghrib), isya: clean(t.Isha) },
        timezone: d.data.meta?.timezone ?? null,
      };
    },
  },
  {
    slug: "quran",
    title: "Al-Quran",
    description: "Surah Al-Quran lengkap dengan teks Arab, latin, dan terjemahan Indonesia. Bisa pilih satu ayat.",
    params: [
      { name: "surah", type: "number", required: true, min: 1, max: 114, description: "Nomor surah (1–114).", example: 1 },
      { name: "ayah", type: "number", min: 1, max: 286, description: "Nomor ayat (opsional).", example: 1 },
    ],
    cache: 86400,
    run: async (ctx) => {
      const n = Math.round(Number(ctx.q.surah));
      const only = ctx.q.ayah === undefined ? null : Math.round(Number(ctx.q.ayah));
      const out = await ctx.first<{ surah: Record<string, unknown>; ayat: { number: number; arabic: string; latin: string | null; translation: string }[] }>([
        async () => {
          const d = (await ctx.json<any>(`https://equran.id/api/v2/surat/${n}`))?.data;
          if (!d?.ayat) throw new UpstreamError("bad shape");
          return { surah: { number: d.nomor, name: d.nama, latinName: d.namaLatin, verses: d.jumlahAyat, revelation: d.tempatTurun, meaning: d.arti }, ayat: d.ayat.map((a: any) => ({ number: a.nomorAyat, arabic: a.teksArab, latin: a.teksLatin ?? null, translation: a.teksIndonesia })) };
        },
        async () => {
          const d = (await ctx.json<any>(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,id.indonesian`))?.data;
          if (!Array.isArray(d) || d.length < 2) throw new UpstreamError("bad shape");
          const [ar, id] = d;
          return { surah: { number: ar.number, name: ar.name, latinName: ar.englishName, verses: ar.numberOfAyahs, revelation: ar.revelationType, meaning: ar.englishNameTranslation }, ayat: ar.ayahs.map((a: any, i: number) => ({ number: a.numberInSurah, arabic: a.text, latin: null, translation: id.ayahs?.[i]?.text ?? "" })) };
        },
      ]);
      if (only === null) return out;
      const ayah = out.ayat.find((a) => a.number === only);
      if (!ayah) throw new ApiError(404, "not_found", `Ayah ${only} does not exist in this surah.`);
      return { surah: out.surah, ayat: [ayah] };
    },
  },
  {
    slug: "surah-list",
    title: "Surah List",
    description: "Daftar 114 surah Al-Quran beserta arti dan jumlah ayat.",
    cache: 86400,
    run: async (ctx) =>
      ctx.first([
        async () => {
          const d = (await ctx.json<any>("https://equran.id/api/v2/surat"))?.data;
          if (!Array.isArray(d)) throw new UpstreamError("bad shape");
          return d.map((s: any) => ({ number: s.nomor, name: s.nama, latinName: s.namaLatin, verses: s.jumlahAyat, revelation: s.tempatTurun, meaning: s.arti }));
        },
        async () => {
          const d = (await ctx.json<any>("https://api.alquran.cloud/v1/surah"))?.data;
          if (!Array.isArray(d)) throw new UpstreamError("bad shape");
          return d.map((s: any) => ({ number: s.number, name: s.name, latinName: s.englishName, verses: s.numberOfAyahs, revelation: s.revelationType, meaning: s.englishNameTranslation }));
        },
      ]),
  },
  {
    slug: "asmaul-husna",
    title: "Asmaul Husna",
    description: "99 nama Allah beserta transliterasi dan arti. Isi `number` untuk satu nama saja.",
    params: [{ name: "number", type: "number", min: 1, max: 99, description: "Nomor (1–99), opsional.", example: 1 }],
    cache: 86400,
    run: async (ctx) => {
      const d = (await ctx.json<any>("https://api.aladhan.com/v1/asmaAlHusna"))?.data;
      if (!Array.isArray(d)) throw new UpstreamError("bad shape");
      const all = d.map((x: any) => ({ number: x.number, arabic: x.name, transliteration: x.transliteration, meaning: x.en?.meaning ?? null }));
      if (ctx.q.number === undefined) return all;
      const one = all.find((x) => x.number === Math.round(Number(ctx.q.number)));
      if (!one) throw new ApiError(404, "not_found", "Name not found.");
      return one;
    },
  },
  {
    slug: "hijri",
    title: "Hijri Date",
    description: "Konversi tanggal Masehi ke Hijriah (kalender Umm al-Qura, dihitung lokal). Bisa selisih ±1 hari dari penetapan Kemenag.",
    params: [{ name: "date", max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/, patternHint: "format YYYY-MM-DD", description: "Tanggal Masehi (default hari ini).", example: "2026-03-20" }],
    cache: 3600,
    run: async (ctx) => {
      const raw = ctx.q.date as string | undefined;
      const date = raw ? new Date(`${raw}T12:00:00Z`) : new Date();
      if (Number.isNaN(date.getTime())) throw new ApiError(400, "invalid_parameter", "Parameter 'date' is not a valid date.");
      const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: "UTC", ...o });
      const p = Object.fromEntries(f({ day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date).map((x) => [x.type, x.value]));
      const monthName = f({ month: "long" }).format(date);
      const year = String(p.year).replace(/\D/g, "");
      return { gregorian: date.toISOString().slice(0, 10), hijri: { day: Number(p.day), month: Number(p.month), monthName, year: Number(year) }, formatted: `${p.day} ${monthName} ${year} H` };
    },
  },
]);
