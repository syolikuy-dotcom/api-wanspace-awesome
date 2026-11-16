/** Error yang aman ditampilkan ke klien (pesan sudah disanitasi). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public type: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Error dari sumber data eksternal. Pesan internal TIDAK pernah dikirim ke klien. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    public upstreamStatus = 0,
    public timeout = false,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export function toPublicError(e: unknown): { status: number; type: string; message: string } {
  if (e instanceof ApiError) return { status: e.status, type: e.type, message: e.message };
  if (e instanceof UpstreamError) {
    if (e.timeout) return { status: 504, type: "upstream_timeout", message: "The data source took too long to respond." };
    if (e.upstreamStatus === 404) return { status: 404, type: "not_found", message: "No data found for this request." };
    if (e.upstreamStatus === 429) return { status: 503, type: "upstream_busy", message: "The data source is busy. Please retry shortly." };
    return { status: 502, type: "upstream_error", message: "The data source is currently unavailable." };
  }
  return { status: 500, type: "internal_error", message: "Something went wrong on our side." };
}
