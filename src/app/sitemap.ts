import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/docs", "/playground", "/status"].map((p) => ({ url: `${site.url}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
