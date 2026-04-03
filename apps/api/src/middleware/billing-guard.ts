import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { accounts } from "@appranks/db";

const GRACE_PERIOD_DAYS = 7;

/**
 * Middleware that blocks write operations when payment grace period has expired.
 * Read-only access is still allowed (GET requests pass through).
 * Accounts with status "free" or "active" are always allowed.
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

    const db = (request.server as any).db;
    if (!db) return;

    try {
      const [account] = await db
        .select({
          subscriptionStatus: accounts.subscriptionStatus,
          pastDueSince: accounts.pastDueSince,
        })
        .from(accounts)
        .where(eq(accounts.id, request.user.accountId));

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
