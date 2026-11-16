import { createCtx } from "./http";
import { ApiError } from "./errors";
import type { EndpointDef, Q } from "./types";

export const EXEC_TIMEOUT_MS = 22_000;

export async function execute(def: EndpointDef, q: Q, opts: { clientIp: string; fresh: boolean; timeoutMs?: number }) {
  const ctx = createCtx(def, q, { clientIp: opts.clientIp, fresh: opts.fresh });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new ApiError(504, "timeout", "The request took too long.")), opts.timeoutMs ?? EXEC_TIMEOUT_MS);
  });
  try {
    const data = await Promise.race([def.run(ctx), timeout]);
    return { data, usedFallback: ctx.usedFallback };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
