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
        .select({ id: users.id, accountId: users.accountId })
        .from(users)
        .where(eq(users.email, invitation.email));

      if (existingUser) {
        if (existingUser.accountId === invitation.accountId) {
          // Already a member of the target account — mark invitation as accepted
          await db
            .update(invitations)
            .set({ acceptedAt: new Date() })
            .where(eq(invitations.id, invitation.id));

          return reply.code(200).send({
            message: "You are already a member of this organization. Invitation marked as accepted.",
            code: "ALREADY_MEMBER",
            user: { id: existingUser.id, email: invitation.email },
          });
        }

        // User exists in a different account — transfer them to the invited account
        const [updatedUser] = await db
          .update(users)
          .set({
            accountId: invitation.accountId,
            role: invitation.role,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        // Mark invitation as accepted
        await db
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.id, invitation.id));

        import("../utils/activity-log.js").then(m => m.logActivity(db, invitation.accountId, updatedUser.id, "invitation_accepted", "user", updatedUser.id, { email: invitation.email, role: invitation.role, transferredFrom: existingUser.accountId })).catch(() => {});

        return {
          message: "Invitation accepted. You have been moved to the new organization.",
          code: "TRANSFERRED",
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
          },
        };
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create user in the invitation's account
      // Email is pre-verified since the user arrived via invitation email link
      const [user] = await db
        .insert(users)
        .values({
          email: invitation.email,
          passwordHash,
          name,
          accountId: invitation.accountId,
          role: invitation.role,
          emailVerifiedAt: new Date(),
        })
        .returning();

      // Mark invitation as accepted
      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      import("../utils/activity-log.js").then(m => m.logActivity(db, invitation.accountId, user.id, "invitation_accepted", "user", user.id, { email: invitation.email, role: invitation.role })).catch(() => {});

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
