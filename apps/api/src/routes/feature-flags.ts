/**
 * Feature flag management routes for system admins.
 * CRUD for feature flags + per-account flag enablement.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, like, notInArray } from "drizzle-orm";
import { featureFlags, accountFeatureFlags, accounts } from "@appranks/db";

const SLUG_REGEX = /^[a-z][a-z0-9-]*$/;

export const featureFlagRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET / — list all flags with account count
  app.get("/", async () => {
    const rows = await db
      .select({
        id: featureFlags.id,
        slug: featureFlags.slug,
        name: featureFlags.name,
        description: featureFlags.description,
        isEnabled: featureFlags.isEnabled,
        activatedAt: featureFlags.activatedAt,
        deactivatedAt: featureFlags.deactivatedAt,
        createdAt: featureFlags.createdAt,
        accountCount: sql<number>`(SELECT count(*)::int FROM account_feature_flags WHERE feature_flag_id = ${featureFlags.id})`,
      })
      .from(featureFlags)
      .orderBy(featureFlags.createdAt);

    return { data: rows };
  });

  // POST / — create a new flag
  app.post("/", async (request, reply) => {
    const body = request.body as {
      slug: string;
      name: string;
      description?: string;
    };

    if (!body.slug || !body.name) {
      return reply.code(400).send({ error: "slug and name are required" });
    }

    if (!SLUG_REGEX.test(body.slug)) {
      return reply
        .code(400)
        .send({ error: "slug must be lowercase letters, numbers, and hyphens only, starting with a letter" });
    }

    // Check uniqueness
    const [existing] = await db
      .select({ id: featureFlags.id })
      .from(featureFlags)
      .where(eq(featureFlags.slug, body.slug))
      .limit(1);

    if (existing) {
      return reply.code(409).send({ error: `Feature flag with slug "${body.slug}" already exists` });
    }

    const [created] = await db
      .insert(featureFlags)
      .values({
        slug: body.slug,
        name: body.name,
        description: body.description || null,
      })
      .returning();

    return reply.code(201).send(created);
  });

  // GET /:slug — flag detail with enabled accounts
  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;

    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.slug, slug))
      .limit(1);

    if (!flag) {
      return reply.code(404).send({ error: "Feature flag not found" });
    }

    // Get enabled accounts with names
    const enabledAccounts = await db
      .select({
        accountId: accountFeatureFlags.accountId,
        enabledAt: accountFeatureFlags.enabledAt,
        accountName: accounts.name,
      })
      .from(accountFeatureFlags)
      .innerJoin(accounts, eq(accounts.id, accountFeatureFlags.accountId))
      .where(eq(accountFeatureFlags.featureFlagId, flag.id))
      .orderBy(accountFeatureFlags.enabledAt);

    return {
      ...flag,
      accountCount: enabledAccounts.length,
      accounts: enabledAccounts,
    };
  });

  // PATCH /:slug — update flag (toggle, edit name/desc)
  app.patch<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const { slug } = request.params;
    const body = request.body as {
      isEnabled?: boolean;
      name?: string;
      description?: string;
    };

    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.slug, slug))
      .limit(1);

    if (!flag) {
      return reply.code(404).send({ error: "Feature flag not found" });
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    if (body.isEnabled !== undefined) {
      updates.isEnabled = body.isEnabled;
      if (body.isEnabled) {
        updates.activatedAt = new Date();
        updates.deactivatedAt = null;
      } else {
        updates.deactivatedAt = new Date();
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    const [updated] = await db
      .update(featureFlags)
      .set(updates)
      .where(eq(featureFlags.id, flag.id))
      .returning();

    return updated;
  });

  // POST /:slug/accounts — enable flag for an account
  app.post<{ Params: { slug: string } }>("/:slug/accounts", async (request, reply) => {
    const { slug } = request.params;
    const body = request.body as { accountId: string };

    if (!body.accountId) {
      return reply.code(400).send({ error: "accountId is required" });
    }

    const [flag] = await db
      .select({ id: featureFlags.id })
      .from(featureFlags)
      .where(eq(featureFlags.slug, slug))
      .limit(1);

    if (!flag) {
      return reply.code(404).send({ error: "Feature flag not found" });
    }

    // Verify account exists
    const [account] = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, body.accountId))
      .limit(1);

    if (!account) {
      return reply.code(404).send({ error: "Account not found" });
    }

    await db
      .insert(accountFeatureFlags)
      .values({
        accountId: body.accountId,
        featureFlagId: flag.id,
      })
      .onConflictDoNothing();

    return reply.code(201).send({
      accountId: account.id,
      accountName: account.name,
      featureFlagId: flag.id,
    });
  });

  // DELETE /:slug/accounts/:accountId — disable flag for an account
  app.delete<{ Params: { slug: string; accountId: string } }>(
    "/:slug/accounts/:accountId",
    async (request, reply) => {
      const { slug, accountId } = request.params;

      const [flag] = await db
        .select({ id: featureFlags.id })
        .from(featureFlags)
        .where(eq(featureFlags.slug, slug))
        .limit(1);

      if (!flag) {
        return reply.code(404).send({ error: "Feature flag not found" });
      }

      const deleted = await db
        .delete(accountFeatureFlags)
        .where(
          and(
            eq(accountFeatureFlags.featureFlagId, flag.id),
            eq(accountFeatureFlags.accountId, accountId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Account does not have this flag enabled" });
      }

      return { message: "Flag disabled for account" };
    },
  );

  // GET /:slug/accounts/search?q= — search accounts not yet enabled for this flag
  app.get<{ Params: { slug: string } }>("/:slug/accounts/search", async (request, reply) => {
    const { slug } = request.params;
    const { q = "" } = request.query as { q?: string };

    const [flag] = await db
      .select({ id: featureFlags.id })
      .from(featureFlags)
      .where(eq(featureFlags.slug, slug))
      .limit(1);

    if (!flag) {
      return reply.code(404).send({ error: "Feature flag not found" });
    }

    // Get account IDs already enabled
    const enabledAccountIds = await db
      .select({ accountId: accountFeatureFlags.accountId })
      .from(accountFeatureFlags)
      .where(eq(accountFeatureFlags.featureFlagId, flag.id));

    const enabledIds = enabledAccountIds.map((r) => r.accountId);

    // Search accounts not in enabled list
    const conditions = [];
    if (enabledIds.length > 0) {
      conditions.push(notInArray(accounts.id, enabledIds));
    }
    if (q.trim()) {
      conditions.push(like(accounts.name, `%${q.trim()}%`));
    }

    const results = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(accounts.name)
      .limit(20);

    return { data: results };
  });
};
