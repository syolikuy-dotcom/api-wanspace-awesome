import { guard } from "@/lib/api/guard";
import { getHistory, getSnapshot } from "@/lib/api/health";
import { cacheHeader, jsonResponse } from "@/lib/api/response";
import { readMetrics } from "@/lib/security/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const g = await guard(req, 2);
  if (g instanceof Response) return g;
  const summaryOnly = new URL(req.url).searchParams.get("summary") === "1";

  const [snapshot, history, metrics] = await Promise.all([getSnapshot({ wait: true }), getHistory(60), readMetrics(30)]);
  cacheHeader(g.headers, 15);
  const body = snapshot ? (summaryOnly ? { ...snapshot, endpoints: [] } : snapshot) : null;
  return jsonResponse(req, { status: true, code: 200, result: { snapshot: body, history, metrics }, meta: { requestId: g.requestId, timestamp: new Date().toISOString() } }, 200, g.headers);
}
