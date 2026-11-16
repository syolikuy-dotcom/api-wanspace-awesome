import { getCategorySummary, endpoints } from "@/lib/api/registry";
import { baseHeaders, cacheHeader, jsonResponse, newRequestId } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = newRequestId();
  const h = baseHeaders(req, id);
  cacheHeader(h, 3600);
  return jsonResponse(
    req,
    {
      status: true,
      code: 200,
      name: "Wanspace API",
      description: "Free REST API platform — no API key required.",
      endpoints: endpoints.length,
      categories: getCategorySummary().map((c) => ({ id: c.id, name: c.name, endpoints: c.count, url: `/api/${c.id}` })),
      links: { docs: "/docs", playground: "/playground", status: "/status", catalog: "/api/endpoints" },
      meta: { requestId: id },
    },
    200,
    h,
  );
}
