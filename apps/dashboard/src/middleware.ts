import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Redirect legacy non-platform paths to /shopify/* equivalents.
 * Also redirect "/" to "/shopify/overview".
 */
const PLATFORM_PAGES = [
  "/overview",
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

const VALID_PLATFORMS = ["shopify", "salesforce", "canva"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect "/" to default platform overview
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/shopify/overview", request.url));
  }

  // Redirect old non-platform paths to /shopify/* equivalents
  // e.g. /apps/formful → /shopify/apps/formful
  const firstSegment = pathname.split("/")[1];
  if (
    PLATFORM_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    !VALID_PLATFORMS.includes(firstSegment!)
  ) {
    return NextResponse.redirect(
      new URL(`/shopify${pathname}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - login, register (auth pages)
     * - terms, privacy (legal pages)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|login|register|terms|privacy).*)",
  ],
};
