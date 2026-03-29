import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { accounts, users } from "@appranks/db";
import { isTokenBlacklisted, isUserTokenRevoked } from "../utils/token-blacklist.js";

export interface JwtPayload {
  jti?: string;
  userId: string;
  email: string;
  accountId: string;
  role: "owner" | "editor" | "viewer";
  isSystemAdmin: boolean;
  realAdmin?: {
    userId: string;
    email: string;
    accountId: string;
  };
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
    isImpersonating: boolean;
  }
}

const PUBLIC_PATHS = [
  "/health",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/invitations/",
  "/api/public/",
  "/api/emails/",
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
  app.decorateRequest("isImpersonating", false);

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for preflight and public paths
      if (request.method === "OPTIONS") {
        return;
      }
      if (PUBLIC_PATHS.some((p) => request.url.startsWith(p))) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, getJwtSecret()) as JwtPayload & { iat?: number };
        request.user = payload;

        // Check token blacklist (jti-based individual revocation)
        if (payload.jti) {
          const blacklisted = await isTokenBlacklisted(payload.jti);
          if (blacklisted) {
            return reply.code(401).send({ error: "Token has been revoked" });
          }
        }

        // Check user-level revocation (revoke-all-sessions)
        if (payload.iat) {
          const userRevoked = await isUserTokenRevoked(payload.userId, payload.iat);
          if (userRevoked) {
            return reply.code(401).send({ error: "All sessions have been revoked" });
          }
        }
      } catch {
        return reply.code(401).send({ error: "Invalid or expired token" });
      }

      // Set impersonation flag
      request.isImpersonating = !!request.user.realAdmin;

      const db = app.db;

      // When impersonating, validate target user still exists
      if (request.isImpersonating) {
        const [targetUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, request.user.userId));
        if (!targetUser) {
          return reply
            .code(403)
            .send({ error: "Impersonated user no longer exists" });
        }
      }

      // System admin route check
      if (
        request.url.startsWith("/api/system-admin") &&
        !request.user.isSystemAdmin
      ) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      // Account suspension check
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
