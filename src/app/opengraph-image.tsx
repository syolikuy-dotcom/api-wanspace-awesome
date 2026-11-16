import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Wanspace API — Free REST API for every project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#09090b", color: "#f4f4f5" }}>
        <div style={{ fontSize: 34, color: "#a1a1aa", letterSpacing: 6, textTransform: "uppercase" }}>api.wanspace.biz.id</div>
        <div style={{ fontSize: 96, fontWeight: 700, marginTop: 24, lineHeight: 1.05 }}>Free REST API</div>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.05, color: "#71717a" }}>for every project.</div>
        <div style={{ fontSize: 34, marginTop: 40, color: "#a1a1aa" }}>90+ endpoints · No API key · Real-time status</div>
      </div>
    ),
    size,
  );
}
