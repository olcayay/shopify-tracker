import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { deadLetterJobs } from "@appranks/db";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../constants.js";
import { Queue } from "bullmq";

const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";
const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";

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
  const db = app.db;

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

    return reply.send({
      data: rows,
      count: rows.length,
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
};
