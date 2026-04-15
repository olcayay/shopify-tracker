"use client";

import { useSyncExternalStore } from "react";

type LayoutVersion = "v1" | "v2";

const COOKIE_RE = /(?:^|;\s*)app-layout-version=(v1|v2)/;

function readCookie(): LayoutVersion {
  if (typeof document === "undefined") return "v2";
  const match = document.cookie.match(COOKIE_RE);
  return match?.[1] === "v1" ? "v1" : "v2";
}

// Static subscription — cookie changes in this codebase trigger a full reload
// (see `classic-view-link.tsx` / `classic-view-banner.tsx`), so we don't need
// to observe cookie mutations.
function subscribe(): () => void {
  return () => {};
}

function getServerSnapshot(): LayoutVersion {
  return "v2";
}

/**
 * Returns the user's selected layout version from the `app-layout-version`
 * cookie (default: v2). Previously sniffed the URL for `/apps/v1/`, but
 * PLA-1110 switched the middleware from redirect → rewrite, so the URL
 * now stays at the bare `/apps/{slug}` form regardless of which tree is
 * rendered internally. Reading the cookie is the source of truth that
 * middleware also uses.
 */
export function useLayoutVersion(): LayoutVersion {
  return useSyncExternalStore(subscribe, readCookie, getServerSnapshot);
}

/**
 * Builds an app detail link that preserves the current layout version.
 * When in v1 layout, links stay in /v1/. When in v2 (or default), links go to /v2/.
 */
export function buildAppLink(
  platform: string,
  slug: string,
  subpath: string = "",
  version: LayoutVersion = "v2"
): string {
  const versionPrefix = version === "v1" ? "/v1/" : "/v2/";
  const base = `/${platform}/apps${versionPrefix}${slug}`;
  return subpath ? `${base}/${subpath}` : base;
}
