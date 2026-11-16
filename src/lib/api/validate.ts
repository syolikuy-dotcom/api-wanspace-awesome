import { ApiError } from "./errors";
import type { ParamDef, Q } from "./types";

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const MAX_PARAMS = 16;

export function parseParams(defs: ParamDef[], sp: URLSearchParams): Q {
  let count = 0;
  sp.forEach(() => count++);
  if (count > MAX_PARAMS) throw new ApiError(400, "invalid_request", "Too many query parameters.");

  const out: Q = {};
  for (const d of defs) {
    const raw = (sp.get(d.name) ?? "").replace(CTRL, "").trim();
    const type = d.type ?? "string";

    if (raw === "") {
      if (d.required) throw new ApiError(400, "missing_parameter", `Parameter '${d.name}' is required.`);
      if (d.default !== undefined) out[d.name] = d.default;
      continue;
    }

    switch (type) {
      case "string": {
        const max = d.max ?? 500;
        if (raw.length > max) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be at most ${max} characters.`);
        if (d.pattern && !d.pattern.test(raw)) {
          throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' is invalid${d.patternHint ? `: ${d.patternHint}` : "."}`);
        }
        out[d.name] = raw;
        break;
      }
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be a number.`);
        if (d.min !== undefined && n < d.min) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be >= ${d.min}.`);
        if (d.max !== undefined && n > d.max) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be <= ${d.max}.`);
        out[d.name] = n;
        break;
      }
      case "boolean": {
        const v = raw.toLowerCase();
        if (!["true", "false", "1", "0"].includes(v)) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be true or false.`);
        out[d.name] = v === "true" || v === "1";
        break;
      }
      case "enum": {
        const hit = d.values?.find((v) => v.toLowerCase() === raw.toLowerCase());
        if (!hit) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be one of: ${d.values?.join(", ")}.`);
        out[d.name] = hit;
        break;
      }
      case "url": {
        if (raw.length > 2048) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' is too long.`);
        let u: URL;
        try {
          u = new URL(raw);
        } catch {
          throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be a valid http(s) URL.`);
        }
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must be a valid http(s) URL.`);
        }
        if (u.username || u.password) throw new ApiError(400, "invalid_parameter", `Parameter '${d.name}' must not contain credentials.`);
        out[d.name] = u.toString();
        break;
      }
    }
  }
  return out;
}
