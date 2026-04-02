import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { accounts } from "@appranks/db";
import { createLogger } from "@appranks/shared";

const log = createLogger("api:billing");

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Dynamic import to avoid requiring stripe when not configured
  const Stripe = require("stripe");
  return new Stripe(key);
}

export const billingRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/billing/status — current subscription status
  app.get("/status", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const [account] = await db
      .select({
        subscriptionStatus: accounts.subscriptionStatus,
        subscriptionPlan: accounts.subscriptionPlan,
        subscriptionPeriodEnd: accounts.subscriptionPeriodEnd,
      })
      .from(accounts)
      .where(eq(accounts.id, request.user.accountId));

    return {
      status: account?.subscriptionStatus || "free",
      plan: account?.subscriptionPlan || null,
      periodEnd: account?.subscriptionPeriodEnd || null,
    };
  });

  // POST /api/billing/create-checkout-session — redirect to Stripe checkout
  app.post("/create-checkout-session", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    if (request.user.role !== "owner") return reply.code(403).send({ error: "Only account owners can manage billing" });

    const stripe = getStripe();
    if (!stripe) return reply.code(503).send({ error: "Billing not configured" });

    const { priceId } = (request.body as any) || {};
    if (!priceId) return reply.code(400).send({ error: "priceId is required" });

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, request.user.accountId));

    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: account.stripeCustomerId || undefined,
      customer_email: account.stripeCustomerId ? undefined : request.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${dashboardUrl}/settings?billing=success`,
      cancel_url: `${dashboardUrl}/settings?billing=cancelled`,
      metadata: { accountId: request.user.accountId },
    });

    return { url: session.url };
  });

  // GET /api/billing/portal — redirect to Stripe customer portal
  app.get("/portal", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    if (request.user.role !== "owner") return reply.code(403).send({ error: "Only account owners can manage billing" });

    const stripe = getStripe();
    if (!stripe) return reply.code(503).send({ error: "Billing not configured" });

    const [account] = await db
      .select({ stripeCustomerId: accounts.stripeCustomerId })
      .from(accounts)
      .where(eq(accounts.id, request.user.accountId));

    if (!account?.stripeCustomerId) {
      return reply.code(400).send({ error: "No billing account found. Please subscribe first." });
    }

    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${dashboardUrl}/settings`,
    });

    return { url: session.url };
  });

  // POST /api/billing/webhook — Stripe webhook handler
  app.post("/webhook", async (request, reply) => {
    const stripe = getStripe();
    if (!stripe) return reply.code(503).send({ error: "Billing not configured" });

    const sig = request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return reply.code(400).send({ error: "Missing signature or webhook secret" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent((request as any).rawBody || JSON.stringify(request.body), sig, webhookSecret);
    } catch (err: any) {
      log.error("Stripe webhook signature verification failed", { error: err.message });
      return reply.code(400).send({ error: "Invalid signature" });
    }

    const data = event.data.object as any;

    switch (event.type) {
      case "checkout.session.completed": {
        const accountId = data.metadata?.accountId;
        if (accountId && data.customer) {
          await db.update(accounts).set({
            stripeCustomerId: data.customer,
            stripeSubscriptionId: data.subscription,
            subscriptionStatus: "active",
            updatedAt: new Date(),
          }).where(eq(accounts.id, accountId));
          log.info("Subscription activated", { accountId });
        }
        break;
      }

      case "invoice.paid": {
        if (data.subscription) {
          const subscription = await stripe.subscriptions.retrieve(data.subscription);
          await db.update(accounts).set({
            subscriptionStatus: "active",
            subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
            updatedAt: new Date(),
          }).where(eq(accounts.stripeCustomerId, data.customer));
        }
        break;
      }

      case "invoice.payment_failed": {
        await db.update(accounts).set({
          subscriptionStatus: "past_due",
          updatedAt: new Date(),
        }).where(eq(accounts.stripeCustomerId, data.customer));
        log.warn("Payment failed", { customer: data.customer });
        break;
      }

      case "customer.subscription.deleted": {
        await db.update(accounts).set({
          subscriptionStatus: "cancelled",
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        }).where(eq(accounts.stripeCustomerId, data.customer));
        log.info("Subscription cancelled", { customer: data.customer });
        break;
      }

      case "customer.subscription.updated": {
        const status = data.status === "active" ? "active" : data.status === "past_due" ? "past_due" : data.status;
        await db.update(accounts).set({
          subscriptionStatus: status,
          subscriptionPlan: data.items?.data?.[0]?.price?.lookup_key || null,
          subscriptionPeriodEnd: data.current_period_end ? new Date(data.current_period_end * 1000) : null,
          updatedAt: new Date(),
        }).where(eq(accounts.stripeCustomerId, data.customer));
        break;
      }

      default:
        log.info("Unhandled webhook event", { type: event.type });
    }

    return { received: true };
  });
};
