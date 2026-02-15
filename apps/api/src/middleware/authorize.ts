import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";

type AccountRole = "owner" | "editor" | "viewer";

export function requireRole(
  ...roles: AccountRole[]
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }
  };
}

export function requireSystemAdmin(): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.isSystemAdmin) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}
