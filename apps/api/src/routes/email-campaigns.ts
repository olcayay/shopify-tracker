/**
 * Admin email campaign API (PLA-707).
 * Create, preview, and send email campaigns to targeted audiences.
 */
import type { FastifyPluginAsync } from "fastify";
import { sql, eq, desc } from "drizzle-orm";
import { emailCampaigns } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { createLogger } from "@appranks/shared";
import { Queue, type ConnectionOptions } from "bullmq";
import type { BulkEmailJobData } from "@appranks/shared";

const log = createLogger("email-campaigns");

const EMAIL_BULK_QUEUE_NAME = "email-bulk";

function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

let _bulkQueue: Queue<BulkEmailJobData> | null = null;
function getBulkQueue(): Queue<BulkEmailJobData> {
  if (!_bulkQueue) {
    _bulkQueue = new Queue<BulkEmailJobData>(EMAIL_BULK_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return _bulkQueue;
}

/**
 * Build audience SQL from audience string (same pattern as notification broadcast).
 */
function buildAudienceQuery(audience: string): string {
  if (audience === "active_last_7d") {
    return "SELECT id, account_id, email, name FROM users WHERE status = 'active' AND last_login_at >= now() - interval '7 days'";
  }
  if (audience === "active_last_30d") {
    return "SELECT id, account_id, email, name FROM users WHERE status = 'active' AND last_login_at >= now() - interval '30 days'";
  }
  if (audience.startsWith("platform:")) {
    const platform = audience.slice("platform:".length).replace(/[^a-z0-9_-]/gi, "");
    return `SELECT DISTINCT u.id, u.account_id, u.email, u.name FROM users u JOIN account_platforms ap ON ap.account_id = u.account_id WHERE u.status = 'active' AND ap.platform = '${platform}'`;
  }
  if (audience.startsWith("user:")) {
    const userId = audience.slice("user:".length).replace(/[^a-f0-9-]/gi, "");
    return `SELECT id, account_id, email, name FROM users WHERE id = '${userId}'`;
  }
  if (audience.startsWith("users:")) {
    const ids = audience
      .slice("users:".length)
      .split(",")
      .map((id) => id.trim().replace(/[^a-f0-9-]/gi, ""))
      .filter(Boolean)
      .map((id) => `'${id}'`)
      .join(",");
    if (!ids) return "SELECT id, account_id, email, name FROM users WHERE false";
    return `SELECT id, account_id, email, name FROM users WHERE id IN (${ids})`;
  }
  if (audience.startsWith("account:")) {
    const accountId = audience.slice("account:".length).replace(/[^a-f0-9-]/gi, "");
    return `SELECT id, account_id, email, name FROM users WHERE account_id = '${accountId}' AND status = 'active'`;
  }
  return "SELECT id, account_id, email, name FROM users WHERE status = 'active'";
}

interface CampaignConfig {
  subject: string;
  htmlBody: string;
  audience: string;
  scheduledAt?: string;
  useLocalTime?: boolean;
  localTimeHour?: number;
}

export const emailCampaignRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // POST /campaigns — create a campaign (draft) (PLA-708: scheduling)
  app.post("/campaigns", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { name, subject, htmlBody, audience, scheduledAt, useLocalTime, localTimeHour } = request.body as {
      name: string;
      subject: string;
      htmlBody: string;
      audience: string;
      scheduledAt?: string;
      useLocalTime?: boolean;
      localTimeHour?: number;
    };

    if (!name || !subject || !htmlBody || !audience) {
      return reply.code(400).send({ error: "name, subject, htmlBody, and audience are required" });
    }

    if (scheduledAt && new Date(scheduledAt) <= new Date()) {
      return reply.code(400).send({ error: "scheduledAt must be in the future" });
    }

    const config: CampaignConfig = { subject, htmlBody, audience, scheduledAt, useLocalTime, localTimeHour };

    const [campaign] = await db
      .insert(emailCampaigns)
      .values({ name, status: "draft", config })
      .returning({ id: emailCampaigns.id });

    return reply.code(201).send({ campaign });
  });

  // GET /campaigns — list campaigns
  app.get("/campaigns", { preHandler: [requireSystemAdmin()] }, async (request) => {
    const { limit } = request.query as { limit?: string };
    const pageSize = Math.min(parseInt(limit || "20", 10), 100);

    const campaigns = await db
      .select({
        id: emailCampaigns.id,
        name: emailCampaigns.name,
        status: emailCampaigns.status,
        totalProspects: emailCampaigns.totalProspects,
        sentCount: emailCampaigns.sentCount,
        openCount: emailCampaigns.openCount,
        clickCount: emailCampaigns.clickCount,
        createdAt: emailCampaigns.createdAt,
      })
      .from(emailCampaigns)
      .orderBy(desc(emailCampaigns.createdAt))
      .limit(pageSize);

    return { campaigns };
  });

  // GET /campaigns/:id — campaign detail
  app.get<{ Params: { id: string } }>("/campaigns/:id", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const [campaign] = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, request.params.id))
      .limit(1);

    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });
    return { campaign };
  });

  // POST /campaigns/:id/preview-audience — preview audience size
  app.post<{ Params: { id: string } }>("/campaigns/:id/preview-audience", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const [campaign] = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, request.params.id))
      .limit(1);

    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });

    const config = campaign.config as CampaignConfig;
    if (!config?.audience) return reply.code(400).send({ error: "Campaign has no audience configured" });

    try {
      const countQuery = `SELECT count(*)::int AS count FROM (${buildAudienceQuery(config.audience)}) sub`;
      const result: any = await db.execute(sql.raw(countQuery));
      const rows = (result as any)?.rows ?? result ?? [];
      const count = parseInt(rows[0]?.count || "0", 10);

      return { audience: config.audience, recipientCount: count };
    } catch (err) {
      return reply.code(400).send({ error: "Invalid audience filter" });
    }
  });

  // POST /campaigns/preview-audience — preview audience without a campaign
  app.post("/campaigns/preview-audience", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { audience } = request.body as { audience: string };
    if (!audience) return reply.code(400).send({ error: "audience is required" });

    try {
      const countQuery = `SELECT count(*)::int AS count FROM (${buildAudienceQuery(audience)}) sub`;
      const result: any = await db.execute(sql.raw(countQuery));
      const rows = (result as any)?.rows ?? result ?? [];
      const count = parseInt(rows[0]?.count || "0", 10);

      return { audience, recipientCount: count };
    } catch (err) {
      return reply.code(400).send({ error: "Invalid audience filter" });
    }
  });

  // POST /campaigns/:id/send — send the campaign
  app.post<{ Params: { id: string } }>("/campaigns/:id/send", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const [campaign] = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, request.params.id))
      .limit(1);

    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });
    if (campaign.status !== "draft") {
      return reply.code(400).send({ error: `Campaign is in '${campaign.status}' status, only draft campaigns can be sent` });
    }

    const config = campaign.config as CampaignConfig;
    if (!config?.subject || !config?.htmlBody || !config?.audience) {
      return reply.code(400).send({ error: "Campaign missing subject, htmlBody, or audience" });
    }

    // Get target users (include timezone for local-time delivery)
    const baseQuery = buildAudienceQuery(config.audience);
    const userQuery = config.useLocalTime
      ? baseQuery.replace("SELECT ", "SELECT u.timezone, ").replace("SELECT DISTINCT ", "SELECT DISTINCT u.timezone, ")
      : baseQuery;
    const usersResult: any = await db.execute(sql.raw(userQuery));
    const users = ((usersResult as any)?.rows ?? usersResult ?? []) as Array<{
      id: string;
      account_id: string;
      email: string;
      name: string;
      timezone?: string;
    }>;

    // Update campaign status
    await db
      .update(emailCampaigns)
      .set({
        status: "sending",
        totalProspects: users.length,
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, campaign.id));

    // Enqueue emails with optional scheduling delay (PLA-708)
    const queue = getBulkQueue();
    let enqueued = 0;
    const globalDelay = config.scheduledAt ? Math.max(0, new Date(config.scheduledAt).getTime() - Date.now()) : 0;
    const targetHour = config.localTimeHour ?? 9;

    for (const user of users) {
      try {
        // Calculate per-user delay for timezone-aware delivery
        let delay = globalDelay;
        if (config.useLocalTime && user.timezone) {
          try {
            const now = new Date();
            const userNow = new Date(now.toLocaleString("en-US", { timeZone: user.timezone }));
            const targetTime = new Date(userNow);
            targetTime.setHours(targetHour, 0, 0, 0);
            if (targetTime <= userNow) targetTime.setDate(targetTime.getDate() + 1);
            delay = targetTime.getTime() - userNow.getTime();
          } catch {
            // Invalid timezone — use global delay
          }
        }

        const jobData: BulkEmailJobData = {
          type: "email_campaign",
          to: user.email,
          name: user.name,
          userId: user.id,
          accountId: user.account_id,
          payload: {
            subject: config.subject,
            htmlBody: config.htmlBody,
          },
          campaignId: campaign.id,
          createdAt: new Date().toISOString(),
        };
        await queue.add(`campaign:${campaign.id}`, jobData, {
          ...(delay > 0 ? { delay } : {}),
        });
        enqueued++;
      } catch (err) {
        log.warn("failed to enqueue campaign email", { userId: user.id, error: String(err) });
      }
    }

    // Update status
    const finalStatus = (config.scheduledAt || config.useLocalTime) ? "scheduled" : "sent";
    await db
      .update(emailCampaigns)
      .set({
        status: finalStatus,
        sentCount: enqueued,
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, campaign.id));

    log.info("campaign sent", { campaignId: campaign.id, totalUsers: users.length, enqueued });

    return {
      message: "Campaign emails enqueued",
      campaignId: campaign.id,
      totalUsers: users.length,
      enqueued,
    };
  });

  // POST /campaigns/send-to-user — send single email to specific user
  app.post("/campaigns/send-to-user", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { userId, subject, htmlBody } = request.body as {
      userId: string;
      subject: string;
      htmlBody: string;
    };

    if (!userId || !subject || !htmlBody) {
      return reply.code(400).send({ error: "userId, subject, and htmlBody are required" });
    }

    // Get user info
    const userResult: any = await db.execute(
      sql`SELECT id, account_id, email, name FROM users WHERE id = ${userId} LIMIT 1`
    );
    const users = ((userResult as any)?.rows ?? userResult ?? []) as Array<{
      id: string;
      account_id: string;
      email: string;
      name: string;
    }>;

    if (users.length === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const user = users[0];
    const queue = getBulkQueue();

    const jobData: BulkEmailJobData = {
      type: "email_campaign",
      to: user.email,
      name: user.name,
      userId: user.id,
      accountId: user.account_id,
      payload: { subject, htmlBody },
      createdAt: new Date().toISOString(),
    };

    const job = await queue.add("campaign:single", jobData);

    return { message: "Email enqueued", jobId: job.id, recipient: user.email };
  });

  // DELETE /campaigns/:id — delete a draft campaign
  app.delete<{ Params: { id: string } }>("/campaigns/:id", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const [campaign] = await db
      .select({ id: emailCampaigns.id, status: emailCampaigns.status })
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, request.params.id))
      .limit(1);

    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });
    if (campaign.status !== "draft") {
      return reply.code(400).send({ error: "Only draft campaigns can be deleted" });
    }

    await db.delete(emailCampaigns).where(eq(emailCampaigns.id, campaign.id));
    return { success: true };
  });
};
