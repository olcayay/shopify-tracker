import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";

export type AccountRole = "owner" | "admin" | "editor" | "viewer";

/** Numeric role levels for hierarchy comparison (higher = more privileged) */
const ROLE_LEVEL: Record<AccountRole, number> = {
  owner: 100,
  admin: 75,
  editor: 50,
  viewer: 25,
};

/** Check if a role has at least the given privilege level */
export function hasRoleLevel(userRole: string, requiredRole: AccountRole): boolean {
  const userLevel = ROLE_LEVEL[userRole as AccountRole] ?? 0;
  const requiredLevel = ROLE_LEVEL[requiredRole];
  return userLevel >= requiredLevel;
}

/** Check if actorRole can manage targetRole (actor must be strictly higher) */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  const actorLevel = ROLE_LEVEL[actorRole as AccountRole] ?? 0;
  const targetLevel = ROLE_LEVEL[targetRole as AccountRole] ?? 0;
  return actorLevel > targetLevel;
}

export function requireRole(
  ...roles: AccountRole[]
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    if (!roles.includes(request.user.role as AccountRole)) {
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
