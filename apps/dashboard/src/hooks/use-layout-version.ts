"use client";

import { usePathname } from "next/navigation";

type LayoutVersion = "v1" | "v2";

/**
 * Detects the current layout version from the URL path.
 * Returns "v1" if the path contains /apps/v1/, otherwise "v2".
 */
export function useLayoutVersion(): LayoutVersion {
  const pathname = usePathname();
  return pathname.includes("/apps/v1/") ? "v1" : "v2";
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
