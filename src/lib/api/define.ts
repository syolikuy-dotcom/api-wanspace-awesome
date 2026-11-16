import type { CategoryId } from "../../config/categories";
import type { EndpointDef, EndpointInput } from "./types";

/** Membuat daftar endpoint untuk satu kategori dengan default yang konsisten. */
export function group(category: CategoryId, inputs: EndpointInput[]): EndpointDef[] {
  return inputs.map((d) => ({
    cache: 60,
    cost: 1,
    output: "json" as const,
    ...d,
    params: d.params ?? [],
    tags: d.tags ?? [],
    quota: d.quota ?? false,
    category,
    id: `${category}/${d.slug}`,
  }));
}

/* ───────── helper kecil dipakai banyak endpoint ───────── */

export const pick = <T extends object, K extends keyof T>(o: T | null | undefined, keys: K[]): Partial<Pick<T, K>> => {
  const out: Partial<Pick<T, K>> = {};
  if (!o) return out;
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
};

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const enc = encodeURIComponent;

export const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : v == null ? d : String(v));

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LIMIT_PARAM = (def = 10, max = 25) => ({
  name: "limit",
  type: "number" as const,
  default: def,
  min: 1,
  max,
  description: `Jumlah hasil (1–${max}).`,
  example: Math.min(def, 5),
});
