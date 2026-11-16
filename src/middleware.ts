import { NextResponse, type NextRequest } from "next/server";
import { getClientIp, hashId, isStaticBlocked } from "@/lib/security/client-id";
import { inspect } from "@/lib/security/rules";
import { addStrike } from "@/lib/security/limiter";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icon-192.png|icon-512.png).*)"],
};

const reject = (status: number, reason: string) =>
  new NextResponse(JSON.stringify({ status: false, code: status, error: { type: reason, message: "Request rejected." } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ip = getClientIp(req.headers);

  if (isStaticBlocked(ip)) return reject(403, "forbidden");

  const verdict = inspect(pathname, search, req.headers.get("user-agent") ?? "", req.method);
  if (!verdict.ok) {
    if (verdict.strike) void addStrike(await hashId(ip));
    return reject(verdict.status, verdict.reason);
  }
  return NextResponse.next();
}
