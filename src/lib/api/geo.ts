import { UpstreamError } from "./errors";
import type { Ctx } from "./types";

export interface Place {
  name: string;
  region: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

/** Geocoding Open-Meteo (tanpa key). Melempar 404 bila kota tidak ditemukan. */
export async function geocode(ctx: Ctx, city: string): Promise<Place> {
  const g = await ctx.json<any>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=id&format=json`);
  const r = g?.results?.[0];
  if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number") throw new UpstreamError("not found", 404);
  return {
    name: r.name,
    region: r.admin1 ?? null,
    country: r.country ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? null,
  };
}
