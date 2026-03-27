const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return Response.json({ status: "ok", api: "ok", timestamp: new Date().toISOString() });
    }
    return Response.json(
      { status: "error", api: "unhealthy", error: `API returned ${res.status}`, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  } catch (err) {
    return Response.json(
      { status: "error", api: "unreachable", error: String(err), timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
