/**
 * Email scheduling routes — schedule, list, and cancel delayed email sends.
 */
import type { FastifyPluginAsync } from "fastify";
import { requireSystemAdmin } from "../middleware/authorize.js";
import { Queue } from "bullmq";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

export const emailSchedulingRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/system-admin/email-scheduling/schedule — schedule an email
  app.post("/schedule", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { type, to, payload, sendAt, queue: queueType } = request.body as {
      type: string;
      to: string;
      payload: Record<string, unknown>;
      sendAt: string;
      queue?: "instant" | "bulk";
    };

    if (!type || !to || !sendAt) {
      return reply.code(400).send({ error: "type, to, and sendAt are required" });
    }

    const sendAtDate = new Date(sendAt);
    if (isNaN(sendAtDate.getTime())) {
      return reply.code(400).send({ error: "Invalid sendAt date" });
    }

    const delayMs = Math.max(0, sendAtDate.getTime() - Date.now());
    const queueName = queueType === "bulk" ? "email-bulk" : "email-instant";

    const queue = new Queue(queueName, { connection: getRedisConnection() });
    try {
      const job = await queue.add(`scheduled:${type}`, { type, to, payload }, {
        delay: delayMs,
      });

      return reply.send({
        jobId: job.id,
        scheduledFor: sendAtDate.toISOString(),
        delayMs,
        queue: queueName,
      });
    } finally {
      await queue.close();
    }
  });

  // GET /api/system-admin/email-scheduling/scheduled — list scheduled emails
  app.get("/scheduled", { preHandler: [requireSystemAdmin()] }, async (_request, reply) => {
    const conn = getRedisConnection();
    const results: { queue: string; jobs: unknown[] }[] = [];

    for (const queueName of ["email-instant", "email-bulk"]) {
      const queue = new Queue(queueName, { connection: conn });
      try {
        const delayed = await queue.getDelayed();
        results.push({
          queue: queueName,
          jobs: delayed.map((j) => ({
            id: j.id,
            name: j.name,
            data: j.data,
            delay: j.opts?.delay,
            scheduledFor: j.opts?.delay
              ? new Date(j.timestamp + (j.opts.delay ?? 0)).toISOString()
              : null,
            createdAt: new Date(j.timestamp).toISOString(),
          })),
        });
      } finally {
        await queue.close();
      }
    }

    return reply.send({ data: results });
  });

  // DELETE /api/system-admin/email-scheduling/:jobId — cancel a scheduled email
  app.delete("/:jobId", { preHandler: [requireSystemAdmin()] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { queue: queueType } = request.query as { queue?: string };

    const queueName = queueType === "bulk" ? "email-bulk" : "email-instant";
    const queue = new Queue(queueName, { connection: getRedisConnection() });

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: "Job not found" });
      }

      const state = await job.getState();
      if (state !== "delayed") {
        return reply.code(409).send({ error: `Job is ${state}, not delayed — cannot cancel` });
      }

      await job.remove();
      return reply.send({ message: "Scheduled email cancelled", jobId });
    } finally {
      await queue.close();
    }
  });
};
