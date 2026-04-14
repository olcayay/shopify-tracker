import { eq, sql, inArray, and } from "drizzle-orm";
import { accountPlatforms, featureFlags, sqlArray } from "@appranks/db";
import { PLATFORM_IDS, platformFeatureFlagSlug, type PlatformId } from "@appranks/shared";

/**
 * Single source of truth for platform access:
 *   - `account_platforms` row = subscription ("account has this platform")
 *   - `feature_flags.platform-<id>` (3-tier: global / account / user) = launch + early-access gate
 *
 * Visible platform = subscribed AND flag enabled for this user.
 */

/** Resolve which platform feature flags are effectively enabled for a user (3-tier). */
export async function resolveEnabledPlatformFlags(
  db: any,
  accountId: string,
  userId?: string,
): Promise<Set<string>> {
  const slugToPlatform = new Map<string, string>();
  for (const p of PLATFORM_IDS as readonly string[]) {
    slugToPlatform.set(platformFeatureFlagSlug(p as PlatformId), p);
  }
  const slugs = Array.from(slugToPlatform.keys());

  const rows: Array<{ slug: string }> = await db.execute(sql`
    SELECT DISTINCT slug FROM (
      SELECT ff.slug FROM feature_flags ff
        WHERE ff.is_enabled = true AND ff.slug = ANY(${sqlArray(slugs, "text")})
      UNION
      SELECT ff.slug FROM feature_flags ff
        INNER JOIN account_feature_flags aff ON aff.feature_flag_id = ff.id
        WHERE aff.account_id = ${accountId} AND ff.slug = ANY(${sqlArray(slugs, "text")})
      ${userId
        ? sql`UNION
      SELECT ff.slug FROM feature_flags ff
        INNER JOIN user_feature_flags uff ON uff.feature_flag_id = ff.id
        WHERE uff.user_id = ${userId} AND uff.enabled = true AND ff.slug = ANY(${sqlArray(slugs, "text")})`
        : sql``}
    ) AS enabled_flags
    ${userId
      ? sql`WHERE slug NOT IN (
      SELECT ff.slug FROM feature_flags ff
        INNER JOIN user_feature_flags uff ON uff.feature_flag_id = ff.id
        WHERE uff.user_id = ${userId} AND uff.enabled = false
    )`
      : sql``}
  `);

  const result = new Set<string>();
  for (const r of rows as Array<{ slug: string }>) {
    const p = slugToPlatform.get(r.slug);
    if (p) result.add(p);
  }
  return result;
}

/** Platforms globally launched (used by unauthenticated public endpoints). */
export async function resolveGloballyEnabledPlatforms(db: any): Promise<Set<string>> {
  const slugToPlatform = new Map<string, string>();
  for (const p of PLATFORM_IDS as readonly string[]) {
    slugToPlatform.set(platformFeatureFlagSlug(p as PlatformId), p);
  }
  const slugs = Array.from(slugToPlatform.keys());
  const rows: { slug: string }[] = await db
    .select({ slug: featureFlags.slug })
    .from(featureFlags)
    .where(and(eq(featureFlags.isEnabled, true), inArray(featureFlags.slug, slugs)));
  const out = new Set<string>();
  for (const r of rows) {
    const p = slugToPlatform.get(r.slug);
    if (p) out.add(p);
  }
  return out;
}

/** Subscribed platforms for an account. */
export async function getSubscribedPlatforms(db: any, accountId: string): Promise<string[]> {
  const rows = await db
    .select({ platform: accountPlatforms.platform })
    .from(accountPlatforms)
    .where(eq(accountPlatforms.accountId, accountId));
  return rows.map((r: { platform: string }) => r.platform);
}

/**
 * Platforms this account/user can access: subscribed ∩ feature-flag enabled.
 * Pass `userId` to honor per-user overrides.
 */
export async function getVisiblePlatformsForAccount(
  db: any,
  accountId: string,
  userId?: string,
): Promise<string[]> {
  const [subscribed, enabledFlags] = await Promise.all([
    getSubscribedPlatforms(db, accountId),
    resolveEnabledPlatformFlags(db, accountId, userId),
  ]);
  return subscribed.filter((p) => enabledFlags.has(p));
}

/** Filter a caller-supplied platform list to globally launched ones (public/unauth endpoints). */
export async function filterGloballyVisiblePlatforms(db: any, platforms: string[]): Promise<string[]> {
  if (platforms.length === 0) return [];
  const enabled = await resolveGloballyEnabledPlatforms(db);
  return platforms.filter((p) => enabled.has(p));
}

// ---------- Pure resolvers (kept for unit tests / reuse) ----------

/** Intersect subscribed platforms with enabled flags. */
export function resolveVisiblePlatformsForAccount(
  subscribedPlatforms: string[],
  enabledPlatformFlags: ReadonlySet<string>,
): string[] {
  return subscribedPlatforms.filter((p) => enabledPlatformFlags.has(p));
}

/** Filter an arbitrary platform list by a set of globally-launched platform ids. */
export function resolveGloballyVisiblePlatforms(
  platforms: string[],
  globallyEnabledPlatforms: ReadonlySet<string>,
): string[] {
  return platforms.filter((p) => globallyEnabledPlatforms.has(p));
}
