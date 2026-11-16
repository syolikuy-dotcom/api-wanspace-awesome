import type { CategoryId } from "../../config/categories";

export type Q = Record<string, string | number | boolean | undefined>;

export type ParamType = "string" | "number" | "url" | "enum" | "boolean";

export interface ParamDef {
  name: string;
  type?: ParamType;
  required?: boolean;
  default?: string | number | boolean;
  description: string;
  example?: string | number | boolean;
  /** string: panjang maks (default 500). number: nilai maks. */
  max?: number;
  min?: number;
  values?: readonly string[];
  /** hanya server-side (tidak dikirim ke katalog) */
  pattern?: RegExp;
  patternHint?: string;
}

export interface FetchInit {
  method?: "GET" | "POST" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  /** timeout per request (ms) */
  timeout?: number;
  /** batas ukuran respons (byte) */
  maxBytes?: number;
  /** TTL cache data-fetch Next (detik). Default = TTL endpoint. */
  ttl?: number;
  /** potong respons di maxBytes (alih-alih error) — untuk scraping HTML besar */
  truncate?: boolean;
}

export interface BinaryResult {
  __binary: true;
  contentType: string;
  body: Uint8Array;
}

export interface PublicResponse {
  status: number;
  finalUrl: string;
  headers: Headers;
  text: string;
  ms: number;
  redirects: string[];
}

export interface Ctx {
  q: Q;
  /** IP asli klien (hanya di memori, tidak pernah disimpan/dikembalikan). */
  clientIp: string;
  json<T = any>(url: string, init?: FetchInit): Promise<T>;
  text(url: string, init?: FetchInit): Promise<string>;
  bin(url: string, init?: FetchInit): Promise<{ body: Uint8Array; contentType: string }>;
  /** Fetch ke URL milik pengguna dengan perlindungan SSRF (blok IP privat, batas redirect). */
  publicFetch(url: string, init?: FetchInit & { method?: "GET" | "HEAD" }): Promise<PublicResponse>;
  /** Coba beberapa sumber berurutan; tandai `degraded` bila sumber utama gagal. */
  first<T>(sources: (() => Promise<T>)[]): Promise<T>;
  /** true jika sumber utama gagal dan fallback dipakai */
  usedFallback: boolean;
}

export interface EndpointInput {
  slug: string;
  title: string;
  description: string;
  params?: ParamDef[];
  /** TTL cache CDN (detik). 0 = tanpa cache. Bisa fungsi bila bergantung parameter. */
  cache?: number | ((q: Q) => number);
  /** bobot rate-limit (default 1). Endpoint berat/lambat = lebih tinggi. */
  cost?: number;
  output?: "json" | "image" | "svg";
  /** upstream dengan kuota ketat → probe status memakai cache, bukan fresh */
  quota?: boolean;
  tags?: string[];
  run: (ctx: Ctx) => Promise<unknown>;
}

export interface EndpointDef extends Required<Omit<EndpointInput, "params" | "tags" | "quota">> {
  id: string;
  category: CategoryId;
  params: ParamDef[];
  tags: string[];
  quota: boolean;
}

export interface CatalogParam {
  name: string;
  type: ParamType;
  required: boolean;
  default?: string | number | boolean;
  description: string;
  example?: string | number | boolean;
  values?: readonly string[];
  max?: number;
  min?: number;
  hint?: string;
}

export interface CatalogEndpoint {
  id: string;
  category: CategoryId;
  slug: string;
  path: string;
  title: string;
  description: string;
  output: "json" | "image" | "svg";
  params: CatalogParam[];
  example: string;
  tags: string[];
}

export function isBinary(v: unknown): v is BinaryResult {
  return typeof v === "object" && v !== null && (v as BinaryResult).__binary === true;
}

export const binary = (body: Uint8Array, contentType: string): BinaryResult => ({ __binary: true, body, contentType });
