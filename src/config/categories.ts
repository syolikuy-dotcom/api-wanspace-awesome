export const CATEGORY_IDS = ["ai", "anime", "news", "tools", "media", "games", "info", "islamic", "fun", "maker"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryMeta = { id: CategoryId; name: string; description: string; icon: string };

/** `icon` = nama ikon lucide-react (dipetakan di komponen UI). */
export const CATEGORIES: CategoryMeta[] = [
  { id: "ai", name: "AI", description: "Chat, terjemahan, deteksi bahasa, ringkasan & gambar AI.", icon: "Sparkles" },
  { id: "anime", name: "Anime", description: "Pencarian anime/manga, jadwal, karakter, trending & gambar.", icon: "Clapperboard" },
  { id: "news", name: "News", description: "Berita Indonesia & dunia dari banyak sumber (RSS).", icon: "Newspaper" },
  { id: "tools", name: "Tools", description: "Cuaca, DNS, WHOIS, kurs, crypto, preview link, hash, dll.", icon: "Wrench" },
  { id: "media", name: "Media", description: "Info YouTube/Spotify/TikTok, musik, film, TV, buku.", icon: "Film" },
  { id: "games", name: "Games", description: "Pokémon, game gratis, giveaway, deal, trivia, Minecraft.", icon: "Gamepad2" },
  { id: "info", name: "Info", description: "Gempa, negara, hari libur, Wikipedia, kamus, GitHub, npm.", icon: "Globe2" },
  { id: "islamic", name: "Islamic", description: "Jadwal sholat, Al-Quran, Asmaul Husna, kalender Hijriah.", icon: "MoonStar" },
  { id: "fun", name: "Fun", description: "Joke, quote, fakta, gambar hewan, meme, 8-ball.", icon: "PartyPopper" },
  { id: "maker", name: "Maker", description: "Avatar, meme, placeholder, badge, quote card, teks unik.", icon: "Palette" },
];

export const isCategory = (v: string): v is CategoryId => (CATEGORY_IDS as readonly string[]).includes(v);
