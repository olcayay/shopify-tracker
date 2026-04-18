import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, isNull, and, gte, lte, like } from "drizzle-orm";
import { deadLetterJobs } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, DLQ_ALERT_THRESHOLD } from "../constants.js";
import { Queue } from "bullmq";

const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";
const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";
const EMAIL_INSTANT_QUEUE_NAME = "email-instant";
const EMAIL_BULK_QUEUE_NAME = "email-bulk";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

export const dlqRoutes: FastifyPluginAsync = async (app) => {
  const db = app.writeDb;

  // GET /api/system-admin/dlq — list dead letter jobs
  app.get("/", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { limit, job_type, platform } = request.query as {
      limit?: string;
      job_type?: string;
      platform?: string;
    };

    const pageSize = Math.min(Math.max(parseInt(limit || String(PAGINATION_DEFAULT_LIMIT), 10) || PAGINATION_DEFAULT_LIMIT, 1), PAGINATION_MAX_LIMIT);

    const conditions: ReturnType<typeof eq>[] = [];
    if (job_type) {
      conditions.push(eq(deadLetterJobs.jobType, job_type));
    }
    if (platform) {
      conditions.push(eq(deadLetterJobs.platform, platform));
    }

    let query = db
      .select()
      .from(deadLetterJobs)
      .orderBy(desc(deadLetterJobs.failedAt))
      .limit(pageSize);

    for (const cond of conditions) {
      query = query.where(cond) as typeof query;
    }

    const rows = await query;

    // Count unresolved (non-replayed) DLQ jobs for alert threshold
    let depth = 0;
    try {
      const [depthRow] = await db
        .select({ depth: sql<number>`count(*)::int` })
        .from(deadLetterJobs)
        .where(isNull(deadLetterJobs.replayedAt));
      depth = depthRow?.depth ?? 0;
    } catch {
      // Fallback if count query fails
    }

    return reply.send({
      data: rows,
      count: rows.length,
      depth,
      alert: depth > DLQ_ALERT_THRESHOLD,
    });
  });

  // POST /api/system-admin/dlq/:id/replay — re-enqueue a dead letter job
  app.post("/:id/replay", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dlqId = parseInt(id, 10);
    if (isNaN(dlqId)) {
      return reply.code(400).send({ error: "Invalid DLQ job ID" });
    }

    // Fetch the dead letter job
    const [dlqJob] = await db
      .select()
      .from(deadLetterJobs)
      .where(eq(deadLetterJobs.id, dlqId))
      .limit(1);

    if (!dlqJob) {
      return reply.code(404).send({ error: "Dead letter job not found" });
    }

    if (dlqJob.replayedAt) {
      return reply.code(409).send({ error: "Job has already been replayed" });
    }

    // Re-enqueue via BullMQ
    const queueName = dlqJob.queueName === "interactive"
      ? INTERACTIVE_QUEUE_NAME
      : BACKGROUND_QUEUE_NAME;

    const queue = new Queue(queueName, { connection: getRedisConnection() });
    try {
      const job = await queue.add(`scrape:${dlqJob.jobType}`, dlqJob.payload, {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
      });

      // Mark as replayed
      await db
        .update(deadLetterJobs)
        .set({ replayedAt: new Date() })
        .where(eq(deadLetterJobs.id, dlqId));

      return reply.send({
        message: "Job replayed successfully",
        newJobId: job.id,
        dlqId,
      });
    } finally {
      await queue.close();
    }
  });

  // POST /api/system-admin/dlq/bulk-replay — replay multiple dead letter jobs
  app.post("/bulk-replay", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { job_type, error_class, from_date, to_date, max_jobs } = request.body as {
      job_type?: string;
      error_class?: string;
      from_date?: string;
      to_date?: string;
      max_jobs?: number;
    };

    const limit = Math.min(max_jobs || 100, 500); // cap at 500 per batch

    // Build filter conditions: only unresolved jobs
    const conditions: ReturnType<typeof eq>[] = [isNull(deadLetterJobs.replayedAt)];
    if (job_type) {
      conditions.push(eq(deadLetterJobs.jobType, job_type));
    }
    if (error_class) {
      conditions.push(like(deadLetterJobs.errorMessage, `[${error_class}]%`));
    }
    if (from_date) {
      conditions.push(gte(deadLetterJobs.failedAt, new Date(from_date)));
    }
    if (to_date) {
      conditions.push(lte(deadLetterJobs.failedAt, new Date(to_date)));
    }

    const jobs = await db
      .select()
      .from(deadLetterJobs)
      .where(and(...conditions))
      .orderBy(desc(deadLetterJobs.failedAt))
      .limit(limit);

    if (jobs.length === 0) {
      return reply.send({ message: "No matching jobs to replay", replayed: 0 });
    }

    let replayed = 0;
    let failed = 0;
    const results: { dlqId: number; newJobId?: string; error?: string }[] = [];

    // Rate-limited replay: process sequentially with 100ms delay between jobs
    for (const dlqJob of jobs) {
      try {
        // Determine the correct queue for replay
        let queueName: string;
        if (dlqJob.queueName === EMAIL_INSTANT_QUEUE_NAME || dlqJob.queueName === EMAIL_BULK_QUEUE_NAME) {
          queueName = dlqJob.queueName;
        } else if (dlqJob.queueName === "interactive") {
          queueName = INTERACTIVE_QUEUE_NAME;
        } else {
          queueName = BACKGROUND_QUEUE_NAME;
        }

        const queue = new Queue(queueName, { connection: getRedisConnection() });
        try {
          const job = await queue.add(`replay:${dlqJob.jobType}`, dlqJob.payload, {
            attempts: 2,
            backoff: { type: "exponential", delay: 30_000 },
          });

          await db
            .update(deadLetterJobs)
            .set({ replayedAt: new Date() })
            .where(eq(deadLetterJobs.id, dlqJob.id));

          results.push({ dlqId: dlqJob.id, newJobId: job.id });
          replayed++;
        } finally {
          await queue.close();
        }

        // Rate limit: 100ms between replays (~10 per second)
        if (replayed < jobs.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch (err) {
        results.push({ dlqId: dlqJob.id, error: String(err) });
        failed++;
      }
    }

    return reply.send({
      message: `Bulk replay complete: ${replayed} replayed, ${failed} failed`,
      replayed,
      failed,
      total: jobs.length,
      results,
    });
  });

  // GET /api/system-admin/dlq/stats — DLQ analytics (error distribution)
  app.get("/stats", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    // Error class distribution
    const errorDistribution = await db
      .select({
        errorClass: sql<string>`
          CASE
            WHEN ${deadLetterJobs.errorMessage} LIKE '[provider_down]%' THEN 'provider_down'
            WHEN ${deadLetterJobs.errorMessage} LIKE '[permanent]%' THEN 'permanent'
            WHEN ${deadLetterJobs.errorMessage} LIKE '[transient]%' THEN 'transient'
            ELSE 'unclassified'
          END
        `,
        count: sql<number>`count(*)::int`,
      })
      .from(deadLetterJobs)
      .where(isNull(deadLetterJobs.replayedAt))
      .groupBy(sql`1`);

    // Top failing job types
    const topFailingTypes = await db
      .select({
        jobType: deadLetterJobs.jobType,
        count: sql<number>`count(*)::int`,
      })
      .from(deadLetterJobs)
      .where(isNull(deadLetterJobs.replayedAt))
      .groupBy(deadLetterJobs.jobType)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    // Daily trend (last 7 days)
    const dailyTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${deadLetterJobs.failedAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(deadLetterJobs)
      .where(gte(deadLetterJobs.failedAt, sql`now() - interval '7 days'`))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    return reply.send({
      errorDistribution,
      topFailingTypes,
      dailyTrend,
    });
  });

  // DELETE /api/system-admin/dlq/:id — permanently remove a dead letter job
  app.delete("/:id", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dlqId = parseInt(id, 10);
    if (isNaN(dlqId)) {
      return reply.code(400).send({ error: "Invalid DLQ job ID" });
    }

    const [existing] = await db
      .select({ id: deadLetterJobs.id })
      .from(deadLetterJobs)
      .where(eq(deadLetterJobs.id, dlqId))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Dead letter job not found" });
    }

    await db.delete(deadLetterJobs).where(eq(deadLetterJobs.id, dlqId));

    return reply.send({ message: "Dead letter job deleted", dlqId });
  });
};
