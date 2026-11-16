import { getCategoryEndpoints } from "@/lib/api/registry";
import { baseHeaders, cacheHeader, errorBody, jsonResponse, newRequestId } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { category: string } }) {
  const id = newRequestId();
  const h = baseHeaders(req, id);
  const list = getCategoryEndpoints(params.category.toLowerCase());
  if (list.length === 0) return jsonResponse(req, errorBody(404, "not_found", "Category not found.", id, { docs: "/docs" }), 404, h);
  cacheHeader(h, 3600);
  return jsonResponse(req, { status: true, code: 200, category: params.category.toLowerCase(), result: list.map((e) => ({ endpoint: e.slug, title: e.title, path: `/api/${e.category}/${e.slug}`, params: e.params.map((p) => p.name) })), meta: { requestId: id } }, 200, h);
}
