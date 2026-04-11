import { eq, inArray } from "drizzle-orm";
import { accountPlatforms, platformVisibility } from "@appranks/db";

type AccountPlatformVisibilityRow = {
  platform: string;
  override: boolean | null;
  isVisible: boolean | null;
};

type GlobalPlatformVisibilityRow = {
  platform: string;
  isVisible: boolean | null;
};

export function resolveVisiblePlatformsForAccount(rows: AccountPlatformVisibilityRow[]): string[] {
  return rows
    .filter((row) => row.override === true || row.isVisible !== false)
    .map((row) => row.platform);
}

export function resolveGloballyVisiblePlatforms(
  platforms: string[],
  visibilityRows: GlobalPlatformVisibilityRow[],
): string[] {
  const hiddenPlatforms = new Set(
    visibilityRows
      .filter((row) => row.isVisible === false)
      .map((row) => row.platform),
  );

  return platforms.filter((platform) => !hiddenPlatforms.has(platform));
}

export async function getVisiblePlatformsForAccount(db: any, accountId: string): Promise<string[]> {
  const rows = await db
    .select({
      platform: accountPlatforms.platform,
      override: accountPlatforms.overrideGlobalVisibility,
      isVisible: platformVisibility.isVisible,
    })
    .from(accountPlatforms)
    .leftJoin(platformVisibility, eq(accountPlatforms.platform, platformVisibility.platform))
    .where(eq(accountPlatforms.accountId, accountId));

  return resolveVisiblePlatformsForAccount(rows);
}

export async function filterGloballyVisiblePlatforms(db: any, platforms: string[]): Promise<string[]> {
  if (platforms.length === 0) return [];

  const visibilityRows = await db
    .select({
      platform: platformVisibility.platform,
      isVisible: platformVisibility.isVisible,
    })
    .from(platformVisibility)
    .where(inArray(platformVisibility.platform, platforms));

  return resolveGloballyVisiblePlatforms(platforms, visibilityRows);
}
