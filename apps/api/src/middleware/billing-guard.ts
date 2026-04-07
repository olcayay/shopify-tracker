import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { accounts } from "@appranks/db";

const GRACE_PERIOD_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface BillingCacheEntry {
  subscriptionStatus: string | null;
  pastDueSince: string | null;
  expiry: number;
}

const billingCache = new Map<string, BillingCacheEntry>();

/** Clear billing cache for a specific account (call after subscription changes) */
export function invalidateBillingCache(accountId: string) {
  billingCache.delete(accountId);
}

/**
 * Middleware that blocks write operations when payment grace period has expired.
 * Read-only access is still allowed (GET requests pass through).
 * Accounts with status "free" or "active" are always allowed.
 * Uses a 5-minute TTL cache to avoid querying DB on every write request.
 */
export function requireActiveBilling() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip for read-only requests
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
      return;
    }

    // Skip if no user (handled by auth middleware)
    if (!request.user) return;

    // Skip for system admins
    if (request.user.isSystemAdmin) return;

    const accountId = request.user.accountId;

    // Check cache first
    const cached = billingCache.get(accountId);
    let account: { subscriptionStatus: string | null; pastDueSince: string | null } | undefined;

    if (cached && cached.expiry > Date.now()) {
      account = { subscriptionStatus: cached.subscriptionStatus, pastDueSince: cached.pastDueSince };
    } else {
      const db = (request.server as any).db;
      if (!db) return;

      try {
        const [row] = await db
          .select({
            subscriptionStatus: accounts.subscriptionStatus,
            pastDueSince: accounts.pastDueSince,
          })
          .from(accounts)
          .where(eq(accounts.id, accountId));

        if (row) {
          billingCache.set(accountId, {
            subscriptionStatus: row.subscriptionStatus,
            pastDueSince: row.pastDueSince ? String(row.pastDueSince) : null,
            expiry: Date.now() + CACHE_TTL_MS,
          });
          account = row;
        }
      } catch {
        // Fail-open: don't block requests if billing check fails
        return;
      }
    }

    try {

      if (!account) return;

      // Free and active accounts are always allowed
      const status = account.subscriptionStatus;
      if (status === "free" || status === "active") return;

      // Check grace period for past_due accounts
      if (status === "past_due" && account.pastDueSince) {
        const daysSincePastDue = Math.floor(
          (Date.now() - new Date(account.pastDueSince).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSincePastDue > GRACE_PERIOD_DAYS) {
          return reply.code(402).send({
            error: "Payment required",
            code: "PAYMENT_REQUIRED",
            message: "Your payment has failed and the grace period has expired. Please update your payment method to continue.",
            upgradeUrl: "/settings",
          });
        }
      }

      // Cancelled accounts can still read but not write
      if (status === "cancelled") {
        return reply.code(402).send({
          error: "Subscription cancelled",
          code: "SUBSCRIPTION_CANCELLED",
          message: "Your subscription has been cancelled. Please resubscribe to continue tracking.",
          upgradeUrl: "/pricing",
        });
      }
    } catch {
      // Don't block requests if billing check fails — fail-open
    }
  };
}
