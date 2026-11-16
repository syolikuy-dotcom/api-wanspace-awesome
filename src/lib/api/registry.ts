import { CATEGORIES, type CategoryId } from "../../config/categories";
import ai from "../endpoints/ai";
import anime from "../endpoints/anime";
import news from "../endpoints/news";
import tools from "../endpoints/tools";
import media from "../endpoints/media";
import games from "../endpoints/games";
import info from "../endpoints/info";
import islamic from "../endpoints/islamic";
import fun from "../endpoints/fun";
import maker from "../endpoints/maker";
import type { CatalogEndpoint, EndpointDef, ParamDef } from "./types";

export const endpoints: EndpointDef[] = [...ai, ...anime, ...news, ...tools, ...media, ...games, ...info, ...islamic, ...fun, ...maker];

const map = new Map<string, EndpointDef>();
for (const e of endpoints) {
  if (map.has(e.id)) throw new Error(`Duplicate endpoint id: ${e.id}`);
  map.set(e.id, e);
}

export const getEndpoint = (category: string, slug: string) => map.get(`${category.toLowerCase()}/${slug.toLowerCase()}`);
export const getCategoryEndpoints = (category: string) => endpoints.filter((e) => e.category === category);

export function exampleQuery(params: ParamDef[]): Record<string, string> {
  const q: Record<string, string> = {};
  for (const p of params) if (p.required && p.example !== undefined) q[p.name] = String(p.example);
  return q;
}

export const exampleUrl = (e: Pick<EndpointDef, "category" | "slug" | "params">) => {
  const qs = new URLSearchParams(exampleQuery(e.params)).toString();
  return `/api/${e.category}/${e.slug}${qs ? `?${qs}` : ""}`;
};

/** Katalog aman-serialisasi untuk UI (tanpa fungsi/regex). */
export function getCatalog(): CatalogEndpoint[] {
  return endpoints.map((e) => ({
    id: e.id,
    category: e.category,
    slug: e.slug,
    path: `/api/${e.category}/${e.slug}`,
    title: e.title,
    description: e.description,
    output: e.output,
    tags: e.tags,
    example: exampleUrl(e),
    params: e.params.map((p) => ({
      name: p.name,
      type: p.type ?? "string",
      required: Boolean(p.required),
      default: p.default,
      description: p.description,
      example: p.example,
      values: p.values,
      max: p.max,
      min: p.min,
      hint: p.patternHint,
    })),
  }));
}

export function getCategorySummary() {
  return CATEGORIES.map((c) => ({ ...c, count: endpoints.filter((e) => e.category === c.id).length }));
}

export type { CategoryId };
