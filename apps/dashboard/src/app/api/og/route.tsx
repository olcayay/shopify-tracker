import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "AppRanks";
  const subtitle = searchParams.get("subtitle") || "App Marketplace Intelligence";
  const rating = searchParams.get("rating");
  const reviews = searchParams.get("reviews");
  const type = searchParams.get("type") || "default"; // default, app, comparison, category

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            A
          </div>
          <span style={{ color: "#94a3b8", fontSize: "20px", fontWeight: 600 }}>AppRanks</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: type === "comparison" ? "48px" : "56px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            margin: 0,
            maxWidth: "900px",
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "24px",
            color: "#94a3b8",
            marginTop: "16px",
            maxWidth: "700px",
          }}
        >
          {subtitle}
        </p>

        {/* Rating badge */}
        {rating && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "24px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px 20px",
              width: "fit-content",
            }}
          >
            <span style={{ fontSize: "28px", color: "#fbbf24" }}>★</span>
            <span style={{ fontSize: "28px", fontWeight: 700, color: "white" }}>{rating}</span>
            {reviews && (
              <span style={{ fontSize: "18px", color: "#94a3b8" }}>({reviews} reviews)</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "80px",
            right: "80px",
            display: "flex",
            justifyContent: "space-between",
            color: "#475569",
            fontSize: "16px",
          }}
        >
          <span>appranks.io</span>
          <span>Multi-Platform App Intelligence</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
