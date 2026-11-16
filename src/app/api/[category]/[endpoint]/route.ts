import { ApiError, toPublicError } from "@/lib/api/errors";
import { execute } from "@/lib/api/execute";
import { guard } from "@/lib/api/guard";
import { getCategoryEndpoints, getEndpoint } from "@/lib/api/registry";
import { baseHeaders, cacheHeader, errorBody, jsonResponse, newRequestId, okBody } from "@/lib/api/response";
import { isBinary } from "@/lib/api/types";
import { parseParams } from "@/lib/api/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: { category: string; endpoint: string } };

export async function GET(req: Request, { params }: Ctx) {
  const started = Date.now();
  const def = getEndpoint(params.category, params.endpoint);

  if (!def) {
    const requestId = newRequestId();
    const h = baseHeaders(req, requestId);
    const siblings = getCategoryEndpoints(params.category.toLowerCase()).map((e) => e.slug);
    return jsonResponse(req, errorBody(404, "not_found", "Endpoint not found.", requestId, siblings.length ? { available: siblings } : { docs: "/docs" }), 404, h);
  }

  const g = await guard(req, def.cost);
  if (g instanceof Response) return g;

  try {
    const q = parseParams(def.params, new URL(req.url).searchParams);
    const { data } = await execute(def, q, { clientIp: g.ip, fresh: false });
    const ttl = typeof def.cache === "function" ? def.cache(q) : def.cache;
    cacheHeader(g.headers, ttl);

    if (isBinary(data)) {
      g.headers.set("Content-Type", data.contentType);
      g.headers.set("Content-Disposition", "inline");
      return new Response(req.method === "HEAD" ? null : (data.body as unknown as BodyInit), { status: 200, headers: g.headers });
    }
    return jsonResponse(req, okBody(def.category, def.slug, data, Date.now() - started, g.requestId), 200, g.headers);
  } catch (e) {
    const pub = toPublicError(e);
    cacheHeader(g.headers, 0);
    const extra: Record<string, unknown> = {};
    if (e instanceof ApiError && e.type === "missing_parameter") extra.example = `/api/${def.category}/${def.slug}`;
    return jsonResponse(req, errorBody(pub.status, pub.type, pub.message, g.requestId, extra), pub.status, g.headers);
  }
}

export async function OPTIONS(req: Request) {
  const h = baseHeaders(req, newRequestId());
  h.set("Access-Control-Max-Age", "86400");
  return new Response(null, { status: 204, headers: h });
}

const notAllowed = async (req: Request) => {
  const id = newRequestId();
  const h = baseHeaders(req, id);
  h.set("Allow", "GET, HEAD, OPTIONS");
  return jsonResponse(req, errorBody(405, "method_not_allowed", "Only GET requests are supported.", id), 405, h);
};
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
