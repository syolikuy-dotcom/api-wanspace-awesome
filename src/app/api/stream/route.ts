import { guard } from "@/lib/api/guard";
import { getHistory, getSnapshot } from "@/lib/api/health";
import { readMetrics } from "@/lib/security/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TICK_MS = 5000;
const LIFETIME_MS = 25_000;

/** Server-Sent Events: dorong metrik + snapshot tiap 5 detik. Klien (EventSource) otomatis tersambung ulang. */
export async function GET(req: Request) {
  const g = await guard(req, 2);
  if (g instanceof Response) return g;

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try { controller.close(); } catch { /* sudah tertutup */ }
      };
      const push = async () => {
        if (closed) return;
        try {
          const [snapshot, metrics, history] = await Promise.all([getSnapshot({ wait: false }), readMetrics(30), getHistory(60)]);
          if (closed) return;
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ t: Date.now(), snapshot, metrics, history, probing: !snapshot })}\n\n`));
        } catch {
          controller.enqueue(enc.encode(`event: error\ndata: {}\n\n`));
        }
      };
      controller.enqueue(enc.encode(`retry: 3000\n\n`));
      void push();
      timer = setInterval(push, TICK_MS);
      setTimeout(close, LIFETIME_MS);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  g.headers.set("Content-Type", "text/event-stream; charset=utf-8");
  g.headers.set("Cache-Control", "no-cache, no-transform");
  g.headers.set("X-Accel-Buffering", "no");
  return new Response(stream, { status: 200, headers: g.headers });
}
