import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from "fastify";
import Redis from "ioredis";
import {
  IDEMPOTENCY_TTL_SECONDS,
  REDIS_CONNECT_TIMEOUT_MS,
} from "../constants.js";

const HEADER_NAME = "idempotency-key";
const REDIS_PREFIX = "idempotency:";

interface CachedResponse {
  statusCode: number;
  body: string;
}

declare module "fastify" {
  interface FastifyRequest {
    idempotencyCacheKey?: string;
  }
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    redis = new Redis(url, {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.connect().catch(() => {
      redis = null;
    });
    return redis;
  } catch {
    return null;
  }
}

/** Reset Redis connection — for tests only */
export function _resetRedis(mock?: Redis | null): void {
  redis = mock ?? null;
}

function cacheKey(idempotencyKey: string, accountId: string): string {
  return `${REDIS_PREFIX}${accountId}:${idempotencyKey}`;
}

/**
 * Fastify preHandler that checks for an Idempotency-Key header.
 * - If a cached response exists → replay it.
 * - If processing → 409 Conflict.
 * - Otherwise → mark as processing, let the handler run.
 *
 * Must be paired with `registerIdempotencyOnSend()` on the Fastify instance
 * to capture and cache responses.
 */
export function requireIdempotencyKey(): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers[HEADER_NAME];
    if (!key || typeof key !== "string") return;

    if (key.length > 256) {
      return reply
        .code(400)
        .send({ error: "Idempotency-Key too long (max 256 characters)" });
    }

    const client = getRedis();
    if (!client) return;

    const accountId = request.user?.accountId ?? "anonymous";
    const ck = cacheKey(key, accountId);

    try {
      const cached = await client.get(ck);

      if (cached === "processing") {
        return reply.code(409).send({
          error:
            "A request with this idempotency key is already being processed",
        });
      }

      if (cached) {
        const parsed: CachedResponse = JSON.parse(cached);
        reply.header("x-idempotency-replayed", "true");
        return reply.code(parsed.statusCode).send(JSON.parse(parsed.body));
      }

      // Mark as processing with TTL so it auto-cleans if the request crashes
      await client.set(ck, "processing", "EX", IDEMPOTENCY_TTL_SECONDS);

      // Flag the request so the onSend hook can cache the response
      request.idempotencyCacheKey = ck;
    } catch {
      // Redis unavailable — proceed without idempotency
    }
  };
}

/**
 * Register a global onSend hook that caches responses for idempotent requests.
 * Call this once during app setup.
 */
export function registerIdempotencyOnSend(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply, payload) => {
    const ck = request.idempotencyCacheKey;
    if (!ck) return payload;

    const client = getRedis();
    if (!client) return payload;

    try {
      const statusCode = reply.statusCode;
      if (statusCode >= 200 && statusCode < 300 && payload) {
        const entry: CachedResponse = {
          statusCode,
          body: typeof payload === "string" ? payload : JSON.stringify(payload),
        };
        await client.set(ck, JSON.stringify(entry), "EX", IDEMPOTENCY_TTL_SECONDS);
      } else {
        // Non-success — remove processing marker so the key can be retried
        await client.del(ck);
      }
    } catch {
      // Redis error — ignore
    }

    return payload;
  });
}
