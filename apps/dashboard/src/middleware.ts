import { NextRequest, NextResponse } from "next/server";

/**
 * Redirect authenticated users from "/" to "/overview".
 * Anonymous visitors see the marketing/landing page.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const hasToken = request.cookies.has("access_token");
    if (hasToken) {
      return NextResponse.redirect(new URL("/overview", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
