import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { featureFlags, accountFeatureFlags, userFeatureFlags } from "@appranks/db";
import { isPlatformId, platformFeatureFlagSlug, type PlatformId } from "@appranks/shared";

/** TTL-based cache keyed by "accountId:userId:flagSlug" → boolean */
const accessCache = new Map<string, { allowed: boolean; expiry: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/** Clear cache entries for a specific account (call after flag changes) */
export function invalidatePlatformAccessCache(accountId?: string) {
  if (!accountId) {
    accessCache.clear();
    return;
  }
  for (const key of accessCache.keys()) {
    if (key.startsWith(accountId)) {
      accessCache.delete(key);
    }
  }
}

/**
 * Paths that skip platform access checks entirely.
 * Auth, public, system-admin, and non-platform routes.
 */
const SKIP_PREFIXES = [
  "/api/auth",
  "/api/public",
  "/api/system-admin",
  "/api/admin",
  "/api/billing",
  "/api/invitations",
  "/api/email-preferences",
  "/api/emails",
  "/api/webhooks",
  "/api/notifications",
  "/api/platforms",
  "/health",
];

/**
 * Register a global preHandler that checks platform feature flags.
 *
 * For any authenticated request with a `platform` query parameter,
 * verifies the user's account has access to that platform via the
 * three-tier feature flag system (global → account → user).
 *
 * System admins always bypass this check.
 */
export function registerPlatformAccessGuard(app: FastifyInstance) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Only check requests with a platform query param
    const query = request.query as Record<string, unknown>;
    const platformParam = query?.platform as string | undefined;
    if (!platformParam) return;

    // Skip non-platform or invalid platforms
    if (!isPlatformId(platformParam)) return;

    // Skip paths that don't need platform gating
    const url = request.url.split("?")[0];
    if (SKIP_PREFIXES.some((p) => url.startsWith(p))) return;

    // Skip if no auth (will be caught by auth middleware)
    if (!request.user) return;

    // System admins bypass all platform checks
    if (request.user.isSystemAdmin) return;

    const platform = platformParam as PlatformId;
    const flagSlug = platformFeatureFlagSlug(platform);
    const { accountId, userId } = request.user;
    const cacheKey = `${accountId}:${userId}:${flagSlug}`;

    // Check cache
    const cached = accessCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      if (!cached.allowed) {
        return reply.code(403).send({
          error: "Platform access denied",
          code: "PLATFORM_DISABLED",
          platform,
          message: `Access to ${platform} is not enabled for your account.`,
        });
      }
      return;
    }

    // Query DB: check three-tier flag resolution
    const db = (request.server as any).db;
    if (!db) return; // fail-open if DB unavailable

    try {
      const result: { allowed: boolean }[] = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM ${featureFlags} ff
          WHERE ff.slug = ${flagSlug}
          AND (
            -- Globally enabled
            ff.is_enabled = true
            -- Account-level override
            OR EXISTS (
              SELECT 1 FROM ${accountFeatureFlags} aff
              WHERE aff.feature_flag_id = ff.id
              AND aff.account_id = ${accountId}::uuid
            )
            -- User-level enabled override
            OR EXISTS (
              SELECT 1 FROM ${userFeatureFlags} uff
              WHERE uff.feature_flag_id = ff.id
              AND uff.user_id = ${userId}::uuid
              AND uff.enabled = true
            )
          )
          -- Exclude user-level disabled override
          AND NOT EXISTS (
            SELECT 1 FROM ${userFeatureFlags} uff2
            WHERE uff2.feature_flag_id = ff.id
            AND uff2.user_id = ${userId}::uuid
            AND uff2.enabled = false
          )
        ) AS "allowed"
      `);

      const allowed = result[0]?.allowed ?? true; // fail-open if flag doesn't exist

      accessCache.set(cacheKey, { allowed, expiry: Date.now() + CACHE_TTL_MS });

      if (!allowed) {
        return reply.code(403).send({
          error: "Platform access denied",
          code: "PLATFORM_DISABLED",
          platform,
          message: `Access to ${platform} is not enabled for your account.`,
        });
      }
    } catch {
      // Fail-open: don't block requests if platform check fails
    }
  });
}
