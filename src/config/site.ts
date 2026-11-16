export const site = {
  name: "Wanspace API",
  short: "wanspace",
  domain: "api.wanspace.biz.id",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://api.wanspace.biz.id").replace(/\/+$/, ""),
  tagline: "Free REST API for every project",
  description: "Ratusan endpoint REST API gratis tanpa API key: AI, anime, berita, tools, media, games, info, Islamic, fun & maker. Playground terminal, status real-time, serverless di Vercel.",
  instagram: "https://www.instagram.com/wtf.w4n_/",
} as const;

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "/status", label: "Status" },
] as const;

export const fairUse = { perMin: Number(process.env.RATE_LIMIT_PER_MIN) || 60, burst: Number(process.env.RATE_LIMIT_BURST_10S) || 15 };
