import { NextResponse, type NextRequest } from "next/server";
import { PLATFORM_IDS } from "@appranks/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Paths reachable without a session. Keep in sync with directories under
// `src/app/(auth)/` — a test in `__tests__/middleware.test.ts` enforces this.
export const PUBLIC_PATHS = [
  "/", "/login", "/register", "/invite", "/forgot-password", "/reset-password",
  "/verify-email", "/terms", "/privacy", "/health", "/audit", "/changelog",
  "/contact", "/pricing",
];

const VALID_PLATFORMS: string[] = PLATFORM_IDS;

/** Map v1 app detail tab paths to v2 section paths */
function mapV1PathToV2(v1Rest: string): string {
  const V1_TO_V2: Record<string, string> = {
    "": "",
    "/details": "/studio",
    "/rankings": "/visibility/rankings",
    "/keywords": "/visibility/keywords",
    "/ads": "/visibility/ads",
    "/featured": "/visibility/featured",
    "/competitors": "/intel/competitors",
    "/similar": "/intel/similar",
    "/reviews": "/intel/reviews",
    "/changes": "/intel/changes",
    "/compare": "/studio/draft",
    "/preview": "/studio/preview",
  };
  return V1_TO_V2[v1Rest] ?? "";
}

/** Dashboard pages that should be nested under a [platform] segment. */
const PLATFORM_PAGES = [
  "/apps",
  "/competitors",
  "/keywords",
  "/categories",
  "/featured",
  "/features",
  "/integrations",
  "/research",
];

/** Cross-platform pages that exist at the root level (no platform prefix). */
const CROSS_PLATFORM_PAGES = ["/apps", "/keywords", "/competitors"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))) {
    const token = request.cookies.get("access_token")?.value;
    // Authenticated users: redirect landing/login/register → dashboard
    if (token && (pathname === "/" || pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
    return NextResponse.next();
  }

  // Redirect legacy non-platform paths to /shopify/* equivalents
  // e.g. /apps/formful → /shopify/apps/formful
  const firstSegment = pathname.split("/")[1];
  if (
    PLATFORM_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    !VALID_PLATFORMS.includes(firstSegment!) &&
    !CROSS_PLATFORM_PAGES.includes(pathname)
  ) {
    return NextResponse.redirect(
      new URL(`/shopify${pathname}`, request.url)
    );
  }

  // Route bare app detail pages to v1 or v2 based on user preference cookie.
  // Pattern: /{platform}/apps/{slug} and sub-routes, but NOT /apps/v2/ or /apps/v1/
  //
  // NOTE: this MUST be a rewrite (not a redirect). A 307 redirect fires for RSC
  // prefetches too, and the redirected HTTP/3 RSC request fails at Cloudflare
  // with ERR_QUIC_PROTOCOL_ERROR — the user-visible symptom is a 1–2 minute
  // hang followed by the route-level error boundary rendering "network error".
  // See PLA-1110. A rewrite keeps the URL stable and serves the v1/v2 content
  // internally without an extra HTTP round-trip.
  const appDetailMatch = pathname.match(/^\/([^/]+)\/apps\/(?!v2\/)(?!v1\/)([^/]+)(\/.*)?$/);
  if (appDetailMatch && VALID_PLATFORMS.includes(appDetailMatch[1])) {
    const [, plat, appSlug, rest = ""] = appDetailMatch;
    const layoutPref = request.cookies.get("app-layout-version")?.value;
    const target = layoutPref === "v1"
      ? `/${plat}/apps/v1/${appSlug}${rest}`
      : `/${plat}/apps/v2/${appSlug}${mapV1PathToV2(rest)}`;
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // No tokens at all → redirect to login
  // (Client-side auth-context is the single owner of token refresh to avoid
  //  race conditions with rotation-based refresh tokens — see PLA-1112)
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If access token exists, validate expiry and role
  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));

      // Expired access token but refresh token exists → let client-side handle refresh
      if (payload.exp * 1000 < Date.now()) {
        if (!refreshToken) {
          return NextResponse.redirect(new URL("/login", request.url));
        }
        // Let page load — client-side auth-context will silently refresh
        return NextResponse.next();
      }

      // Block non-system-admin from system-admin routes
      if (pathname.startsWith("/system-admin") && !payload.isSystemAdmin) {
        return NextResponse.redirect(new URL("/overview", request.url));
      }
    } catch {
      // Malformed token — if refresh token exists, let client-side handle it
      if (!refreshToken) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return NextResponse.next();
    }
  }

  // Rewrite /developers/{slug} → /developer/{slug} (internal route uses singular
  // "developer" to avoid Next.js dynamic param conflict with [platform]).
  // Must be AFTER auth checks so token refresh and login redirect still work.
  const devProfileMatch = pathname.match(/^\/developers\/([a-z0-9-]+)$/);
  if (devProfileMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/developer/${devProfileMatch[1]}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|globals.css).*)"],
};
