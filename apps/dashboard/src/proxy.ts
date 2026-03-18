import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PUBLIC_PATHS = ["/", "/login", "/register", "/invite", "/terms", "/privacy"];

const VALID_PLATFORMS = ["shopify", "salesforce", "canva", "wix", "wordpress", "google_workspace", "atlassian"];

/** Dashboard pages that should be nested under a [platform] segment. */
const PLATFORM_PAGES = [
  "/apps",
  "/competitors",
  "/keywords",
  "/categories",
  "/featured",
  "/features",
  "/integrations",
  "/developers",
  "/research",
];

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
  // e.g. /apps/formful → /shopify/apps/formful, /overview → /shopify/overview
  const firstSegment = pathname.split("/")[1];
  if (
    PLATFORM_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    !VALID_PLATFORMS.includes(firstSegment!)
  ) {
    return NextResponse.redirect(
      new URL(`/shopify${pathname}`, request.url)
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
      return NextResponse.redirect(new URL("/shopify/overview", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|globals.css).*)"],
};
