import { getCatalog } from "@/lib/api/registry";
import { baseHeaders, cacheHeader, jsonResponse, newRequestId } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = newRequestId();
  const h = baseHeaders(req, id);
  cacheHeader(h, 3600);
  const catalog = getCatalog();
  return jsonResponse(req, { status: true, code: 200, total: catalog.length, result: catalog, meta: { requestId: id } }, 200, h);
}
