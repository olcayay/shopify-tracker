import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AppRanks — App Marketplace Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: 16,
          }}
        >
          AppRanks
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#94a3b8",
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          App Marketplace Intelligence
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 40,
            fontSize: 18,
            color: "#64748b",
          }}
        >
          <span>Rankings</span>
          <span style={{ color: "#475569" }}>|</span>
          <span>Competitors</span>
          <span style={{ color: "#475569" }}>|</span>
          <span>Keywords</span>
          <span style={{ color: "#475569" }}>|</span>
          <span>11 Platforms</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
