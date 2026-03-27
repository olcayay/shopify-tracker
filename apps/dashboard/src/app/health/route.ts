const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    // Any HTTP response means the API server is reachable (even 401/403 from auth middleware)
    return Response.json({ status: "ok", api: "ok", apiStatus: res.status, timestamp: new Date().toISOString() });
  } catch (err) {
    // Network error or timeout — API is truly down
    return Response.json(
      { status: "error", api: "unreachable", error: String(err), timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
