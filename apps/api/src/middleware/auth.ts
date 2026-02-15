import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { accounts } from "@shopify-tracking/db";

export interface JwtPayload {
  userId: string;
  email: string;
  accountId: string;
  role: "owner" | "editor" | "viewer";
  isSystemAdmin: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/invitations/",
];

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export function registerAuthMiddleware(app: FastifyInstance) {
  app.decorateRequest("user", null as unknown as JwtPayload);

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for public paths
      if (PUBLIC_PATHS.some((p) => request.url.startsWith(p))) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
        request.user = payload;
      } catch {
        return reply.code(401).send({ error: "Invalid or expired token" });
      }

      // System admin route check
      if (
        request.url.startsWith("/api/system-admin") &&
        !request.user.isSystemAdmin
      ) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      // Account suspension check
      const db = (app as any).db;
      const [account] = await db
        .select({ isSuspended: accounts.isSuspended })
        .from(accounts)
        .where(eq(accounts.id, request.user.accountId));

      if (account?.isSuspended && !request.user.isSystemAdmin) {
        return reply.code(403).send({ error: "Account is suspended" });
      }
    }
  );
}
