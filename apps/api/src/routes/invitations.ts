import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  accounts,
  users,
  invitations,
} from "@appranks/db";
import { acceptInvitationSchema } from "../schemas/invitations.js";


export const invitationRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // POST /api/invitations/accept/:token — accept an invitation
  app.post<{ Params: { token: string } }>(
    "/accept/:token",
    async (request, reply) => {
      const { token } = request.params;
      const { name, password } = acceptInvitationSchema.parse(request.body);

      // Find invitation
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.token, token));

      if (!invitation) {
        return reply.code(404).send({ error: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return reply
          .code(400)
          .send({ error: "Invitation already accepted" });
      }

      if (invitation.expiresAt < new Date()) {
        return reply.code(400).send({ error: "Invitation expired" });
      }

      // Check if user already exists with this email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, invitation.email));

      if (existingUser) {
        return reply.code(409).send({
          error: "User with this email already exists",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create user in the invitation's account
      const [user] = await db
        .insert(users)
        .values({
          email: invitation.email,
          passwordHash,
          name,
          accountId: invitation.accountId,
          role: invitation.role,
        })
        .returning();

      // Mark invitation as accepted
      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      return {
        message: "Invitation accepted",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }
  );

  // GET /api/invitations/:token — get invitation details (for UI)
  app.get<{ Params: { token: string } }>(
    "/:token",
    async (request, reply) => {
      const { token } = request.params;

      const [row] = await db
        .select({
          email: invitations.email,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
          inviterName: users.name,
          accountName: accounts.name,
          accountCompany: accounts.company,
        })
        .from(invitations)
        .leftJoin(users, eq(invitations.invitedByUserId, users.id))
        .leftJoin(accounts, eq(invitations.accountId, accounts.id))
        .where(eq(invitations.token, token));

      if (!row) {
        return reply.code(404).send({ error: "Invitation not found" });
      }

      return {
        email: row.email,
        role: row.role,
        expired: row.expiresAt < new Date(),
        accepted: !!row.acceptedAt,
        inviterName: row.inviterName || "A team member",
        accountName: row.accountName || "Unknown",
        accountCompany: row.accountCompany,
      };
    }
  );
};
