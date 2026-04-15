import { eq, and, sql, desc } from "drizzle-orm";
import {
  emailTypeConfigs,
  emailTypeAccountOverrides,
  userEmailPreferences,
  emailLogs,
  featureFlags,
  accountFeatureFlags,
  userFeatureFlags,
} from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("email:eligibility");

/**
 * Resolve a feature flag for a (user, account) pair using the 3-tier
 * precedence documented on the schema:
 *
 *   user_feature_flags (override)  >  account_feature_flags  >  not enabled
 *
 * Returns `true` if the flag is enabled for this user in this account,
 * `false` otherwise. User-level `enabled=false` explicitly overrides an
 * account-level enable (intended semantics for gradual rollout / opt-out).
 *
 * PLA-1099: previously the email pipeline only consulted account_feature_flags
 * and silently dropped emails for users enabled via the admin UI at the
 * user scope. Centralized here so other future gates (ads, AI, etc.) reuse
 * the same resolution and can't repeat the bug class.
 */
export async function isFeatureFlagEnabledForUser(
  db: any,
  slug: string,
  userId: string,
  accountId: string
): Promise<boolean> {
  // 1. User-level override (on or off — both win over account).
  const [userRow] = await db
    .select({ enabled: userFeatureFlags.enabled })
    .from(userFeatureFlags)
    .innerJoin(featureFlags, eq(featureFlags.id, userFeatureFlags.featureFlagId))
    .where(
      and(
        eq(userFeatureFlags.userId, userId),
        eq(featureFlags.slug, slug)
      )
    )
    .limit(1);

  if (userRow) {
    return userRow.enabled === true;
  }

  // 2. Fallback to account-level enablement.
  const [accountRow] = await db
    .select({ id: accountFeatureFlags.id })
    .from(accountFeatureFlags)
    .innerJoin(featureFlags, eq(featureFlags.id, accountFeatureFlags.featureFlagId))
    .where(
      and(
        eq(accountFeatureFlags.accountId, accountId),
        eq(featureFlags.slug, slug)
      )
    )
    .limit(1);

  return !!accountRow;
}

export interface EligibilityResult {
  eligible: boolean;
  skipReason?: string;
}

/**
 * Check if an email can be sent based on all eligibility rules.
 */
/** Maximum alert emails per user per day */
const DAILY_ALERT_EMAIL_LIMIT = 10;

export async function checkEligibility(
  db: any,
  params: {
    emailType: string;
    userId: string;
    accountId: string;
    recipientEmail: string;
    deduplicationKey?: string;
    /** Set to true for admin-triggered test emails — bypasses daily limit */
    skipDailyLimit?: boolean;
  }
): Promise<EligibilityResult> {
  const { emailType, userId, accountId } = params;

  // 0. Feature flag gate: the flag must be enabled for this (user, account)
  // pair. PLA-1099: user-level overrides take precedence over account-level
  // per schema comment — admin UI writes to both tables but the consumer
  // used to only check the account scope, silently blocking user-enabled
  // accounts.
  const flagEnabled = await isFeatureFlagEnabledForUser(
    db,
    "email_alerts_enabled",
    userId,
    accountId
  );

  if (!flagEnabled) {
    log.warn("email blocked by feature flag", {
      emailType,
      userId,
      accountId,
      flag: "email_alerts_enabled",
    });
    return {
      eligible: false,
      skipReason: `feature flag 'email_alerts_enabled' not enabled for user ${userId} (account ${accountId})`,
    };
  }

  // 1. Is email type enabled globally?
  const [typeConfig] = await db
    .select()
    .from(emailTypeConfigs)
    .where(eq(emailTypeConfigs.emailType, emailType))
    .limit(1);

  if (typeConfig && !typeConfig.enabled) {
    return { eligible: false, skipReason: `email type '${emailType}' is globally disabled` };
  }

  // 2. Is email type enabled for this account?
  const [accountOverride] = await db
    .select()
    .from(emailTypeAccountOverrides)
    .where(
      and(
        eq(emailTypeAccountOverrides.accountId, accountId),
        eq(emailTypeAccountOverrides.emailType, emailType)
      )
    )
    .limit(1);

  if (accountOverride?.enabled === false) {
    return { eligible: false, skipReason: `email type '${emailType}' disabled for account` };
  }

  // 3. Has user opted out?
  const [userPref] = await db
    .select()
    .from(userEmailPreferences)
    .where(
      and(
        eq(userEmailPreferences.userId, userId),
        eq(userEmailPreferences.emailType, emailType)
      )
    )
    .limit(1);

  if (userPref?.enabled === false) {
    return { eligible: false, skipReason: `user opted out of '${emailType}'` };
  }

  // 4. Frequency cap check
  const frequencyLimitHours = typeConfig?.frequencyLimitHours;
  if (frequencyLimitHours) {
    const since = new Date(Date.now() - frequencyLimitHours * 3600 * 1000);
    const [recentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.emailType, emailType),
          eq(emailLogs.userId, userId),
          sql`${emailLogs.createdAt} >= ${since.toISOString()}`,
          sql`${emailLogs.status} != 'failed'`
        )
      );

    if (recentCount.count > 0) {
      return { eligible: false, skipReason: `frequency cap: sent within last ${frequencyLimitHours}h` };
    }
  }

  // 5. Deduplication check (same type + user within 1 hour)
  if (params.deduplicationKey) {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const [dupCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.emailType, emailType),
          eq(emailLogs.userId, userId),
          sql`${emailLogs.createdAt} >= ${oneHourAgo.toISOString()}`,
          sql`${emailLogs.dataSnapshot}->>'deduplicationKey' = ${params.deduplicationKey}`
        )
      );

    if (dupCount.count > 0) {
      return { eligible: false, skipReason: "duplicate email suppressed" };
    }
  }

  // 6. Daily alert email limit per user (admin bypass via skipDailyLimit)
  if (!params.skipDailyLimit && emailType.startsWith("email_") && emailType.includes("_alert")) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const [dailyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.userId, userId),
          sql`${emailLogs.emailType} LIKE 'email_%_alert'`,
          sql`${emailLogs.createdAt} >= ${todayMidnight.toISOString()}`,
          sql`${emailLogs.status} != 'failed'`
        )
      );

    if (dailyCount.count >= DAILY_ALERT_EMAIL_LIMIT) {
      return { eligible: false, skipReason: `daily limit reached: ${dailyCount.count}/${DAILY_ALERT_EMAIL_LIMIT} alert emails today` };
    }
  }

  return { eligible: true };
}
