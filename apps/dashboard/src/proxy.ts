import { NextResponse, type NextRequest } from "next/server";
import { PLATFORM_IDS } from "@appranks/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PUBLIC_PATHS = ["/", "/login", "/register", "/invite", "/terms", "/privacy", "/health"];

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

  // Redirect bare app detail pages to v2 (unless user opted for v1/classic)
  // Pattern: /{platform}/apps/{slug} and sub-routes, but NOT /apps/v2/ or /apps/v1/
  const appDetailMatch = pathname.match(/^\/([^/]+)\/apps\/(?!v2\/)(?!v1\/)([^/]+)(\/.*)?$/);
  if (appDetailMatch && VALID_PLATFORMS.includes(appDetailMatch[1])) {
    const [, plat, appSlug, rest = ""] = appDetailMatch;
    // Map v1 tab paths to v2 section paths
    const v2Path = mapV1PathToV2(rest);
    return NextResponse.redirect(
      new URL(`/${plat}/apps/v2/${appSlug}${v2Path}`, request.url)
    );
  }

  const accessToken = request.cookies.get("access_token")?.value;

  // If no access token, try to refresh
  if (!accessToken) {
    const refreshToken = request.cookies.get("refresh_token")?.value;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const response = NextResponse.next();
          response.cookies.set("access_token", data.accessToken, {
            path: "/",
            maxAge: 900,
            sameSite: "lax",
          });
          response.cookies.set("refresh_token", data.refreshToken, {
            path: "/",
            maxAge: 7 * 86400,
            sameSite: "lax",
          });
          return response;
        }
      } catch {
        // refresh failed, redirect to login
      }
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Decode JWT payload to check expiry and role
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));

    // If token expired, try refresh
    if (payload.exp * 1000 < Date.now()) {
      const refreshToken = request.cookies.get("refresh_token")?.value;
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const response = NextResponse.next();
            response.cookies.set("access_token", data.accessToken, {
              path: "/",
              maxAge: 900,
              sameSite: "lax",
            });
            response.cookies.set("refresh_token", data.refreshToken, {
              path: "/",
              maxAge: 7 * 86400,
              sameSite: "lax",
            });
            return response;
          }
        } catch {
          // refresh failed
        }
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Block non-system-admin from system-admin routes
    if (pathname.startsWith("/system-admin") && !payload.isSystemAdmin) {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
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
