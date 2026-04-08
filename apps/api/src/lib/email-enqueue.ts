/**
 * Email enqueue helpers for the API.
 * Enqueues transactional email jobs to the email-instant BullMQ queue.
 * The actual sending is handled by the email-instant worker.
 */
import { Queue, type ConnectionOptions } from "bullmq";
import type { InstantEmailJobData, InstantEmailJobType } from "@appranks/shared";
import { createLogger } from "@appranks/shared";

const log = createLogger("api:email-enqueue");

const EMAIL_INSTANT_QUEUE_NAME = "email-instant";

function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

let _queue: Queue<InstantEmailJobData> | null = null;

function getQueue(): Queue<InstantEmailJobData> {
  if (!_queue) {
    _queue = new Queue<InstantEmailJobData>(EMAIL_INSTANT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 6,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

async function enqueue(
  type: InstantEmailJobType,
  to: string,
  payload: Record<string, unknown>,
  extra?: { name?: string; userId?: string; accountId?: string; priority?: number }
): Promise<string> {
  const data: InstantEmailJobData = {
    type,
    to,
    name: extra?.name,
    userId: extra?.userId,
    accountId: extra?.accountId,
    payload,
    createdAt: new Date().toISOString(),
  };
  const queue = getQueue();
  const job = await queue.add(`email:${type}`, data, {
    priority: extra?.priority,
  });
  log.info("enqueued instant email", { type, to, jobId: job.id });
  return job.id!;
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
  opts?: { userId?: string; accountId?: string }
): Promise<string> {
  return enqueue("email_welcome", email, { name }, { name, ...opts });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name: string,
  opts?: { userId?: string }
): Promise<string> {
  const baseUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return enqueue("email_password_reset", email, { name, resetUrl }, { name, ...opts });
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  name: string,
  opts?: { userId?: string }
): Promise<string> {
  const baseUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return enqueue("email_verification", email, { name, verificationUrl }, { name, ...opts });
}

export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  accountName: string,
  token: string,
  opts?: { role?: string; accountId?: string }
): Promise<string> {
  const baseUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  const acceptUrl = `${baseUrl}/invite/accept/${encodeURIComponent(token)}`;
  return enqueue(
    "email_invitation",
    email,
    { inviterName, accountName, acceptUrl, role: opts?.role },
    { accountId: opts?.accountId }
  );
}

export async function sendLoginAlertEmail(
  email: string,
  name: string,
  device: string,
  opts?: { location?: string; ip?: string; userId?: string }
): Promise<string> {
  const baseUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  const secureAccountUrl = `${baseUrl}/settings`;
  return enqueue(
    "email_login_alert",
    email,
    { name, device, location: opts?.location, ip: opts?.ip, loginTime: new Date().toISOString(), secureAccountUrl },
    { name, ...opts }
  );
}

export async function send2FAEmail(
  email: string,
  code: string,
  name: string,
  opts?: { userId?: string }
): Promise<string> {
  return enqueue("email_2fa_code", email, { name, code }, { name, ...opts, priority: 1 });
}
