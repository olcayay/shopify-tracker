import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Transient DB error codes and messages that are safe to retry on GET requests.
 * These occur during pool recovery, Cloud SQL maintenance, or brief network blips.
 */
const TRANSIENT_ERROR_PATTERNS = [
  "ECONNREFUSED",
  "ECONNRESET",
  "CONNECTION_DESTROYED",
  "connection terminated unexpectedly",
  "Connection terminated unexpectedly",
  "terminating connection due to administrator command",
  "too many clients already",
  "connection timed out",
  "pool_monitor_timeout",
] as const;

const TRANSIENT_PG_CODES = new Set([
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
]);

const RETRY_DELAY_MS = 500;

export function isTransientDbError(error: Error & { code?: string; errno?: string }): boolean {
  // Check PostgreSQL error codes
  if (error.code && TRANSIENT_PG_CODES.has(error.code)) {
    return true;
  }
  // Check postgres.js driver error codes (e.g. CONNECTION_DESTROYED during pool reset)
  if (error.code === "CONNECTION_DESTROYED" || error.errno === "CONNECTION_DESTROYED") {
    return true;
  }
  // Check error message patterns
  const msg = error.message || "";
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => msg.includes(pattern));
}

/**
 * Attempt to retry a GET request once on a transient DB error.
 * Must be called from setErrorHandler (not onError hook, which doesn't allow reply.send).
 * Returns true if the retry was handled, false if the caller should handle the error normally.
 */
export async function tryDbRetry(
  app: FastifyInstance,
  error: Error & { code?: string; errno?: string },
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  // Only retry idempotent GET requests
  if (request.method !== "GET") return false;
  // Only retry once — check if we already retried
  if ((request as any).__dbRetried) return false;
  // Only retry transient DB errors
  if (!isTransientDbError(error)) return false;
  // Don't retry health check endpoints
  if (request.url.startsWith("/health")) return false;

  (request as any).__dbRetried = true;
  request.log.warn({
    msg: "Retrying GET request after transient DB error",
    url: request.url,
    error: error.message,
  });

  // Wait briefly for pool to recover
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

  // Re-inject the request internally
  try {
    const retryResponse = await app.inject({
      method: "GET",
      url: request.url,
      headers: Object.fromEntries(
        Object.entries(request.headers).filter(
          ([k]) => !["host", "content-length"].includes(k)
        ).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v ?? ""])
      ),
    });

    // Send the retry response
    reply.code(retryResponse.statusCode);
    for (const [key, value] of Object.entries(retryResponse.headers)) {
      if (value) reply.header(key, value);
    }
    reply.header("x-db-retry", "true");
    reply.send(retryResponse.body);
    return true;
  } catch (retryErr) {
    request.log.error({
      msg: "DB retry also failed",
      url: request.url,
      error: retryErr instanceof Error ? retryErr.message : String(retryErr),
    });
    return false;
  }
}
