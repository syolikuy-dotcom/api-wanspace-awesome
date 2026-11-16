import { baseHeaders, jsonResponse, newRequestId } from "@/lib/api/response";

export const runtime = "edge";

export async function GET(req: Request) {
  const id = newRequestId();
  const h = baseHeaders(req, id);
  h.set("Cache-Control", "no-store");
  return jsonResponse(req, { status: true, code: 200, result: { ok: true, time: new Date().toISOString() }, meta: { requestId: id } }, 200, h);
}
