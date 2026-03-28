import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  buildTestApp,
  userToken,
  viewerToken,
  authHeaders,
} from "../helpers/test-app.js";
import { accountMemberRoutes } from "../../routes/account-members.js";

describe("Account Member Routes — edge cases", () => {
  let app: FastifyInstance;
  const ownerToken = () =>
    userToken({
      userId: "user-001",
      accountId: "account-001",
      role: "owner",
    });

  beforeAll(async () => {
    app = await buildTestApp({
      routes: accountMemberRoutes,
      prefix: "/api/account",
      db: {
        selectResult: [
          {
            id: "user-002",
            email: "member@test.com",
            name: "Team Member",
            role: "editor",
            accountId: "account-001",
            maxUsers: 10,
            count: 2,
            memberCount: 2,
            pendingCount: 0,
            todayCount: 0,
          },
        ],
        insertResult: [
          {
            id: "new-user",
            email: "new@test.com",
            name: "New User",
            role: "viewer",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // DELETE /api/account/members/:userId — self-removal guard
  // -----------------------------------------------------------------------

  describe("DELETE /api/account/members/:userId", () => {
    it("returns 400 when trying to remove yourself", async () => {
      const token = ownerToken();
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/members/user-001",
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Cannot remove yourself");
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/members/user-002",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 403 for editor role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/members/user-002",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).toBe(403);
    });

    it("allows owner to remove a different member", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/members/user-002",
        headers: authHeaders(ownerToken()),
      });
      // Should not be auth/guard error; mock DB may give 200 or other status
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /api/account/members/:userId/role — self-role-change guard
  // -----------------------------------------------------------------------

  describe("PATCH /api/account/members/:userId/role", () => {
    it("returns 400 when trying to change own role", async () => {
      const token = ownerToken();
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/members/user-001/role",
        headers: authHeaders(token),
        payload: { role: "editor" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Cannot change your own role");
    });

    it("returns 400 with invalid role value", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/members/user-002/role",
        headers: authHeaders(ownerToken()),
        payload: { role: "admin" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 trying to promote to owner", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/members/user-002/role",
        headers: authHeaders(ownerToken()),
        payload: { role: "owner" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid role change from owner", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/members/user-002/role",
        headers: authHeaders(ownerToken()),
        payload: { role: "viewer" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/members — validation
  // -----------------------------------------------------------------------

  describe("POST /api/account/members", () => {
    it("returns 400 with invalid email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(ownerToken()),
        payload: { email: "not-an-email", name: "User", password: "password123" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when name is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(ownerToken()),
        payload: { email: "new@test.com", password: "password123" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects owner role assignment (only editor/viewer allowed)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members",
        headers: authHeaders(ownerToken()),
        payload: { email: "new@test.com", name: "User", password: "password123", role: "owner" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/account/members/invite — validation
  // -----------------------------------------------------------------------

  describe("POST /api/account/members/invite", () => {
    it("returns 400 with invalid email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members/invite",
        headers: authHeaders(ownerToken()),
        payload: { email: "bad-email" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects owner role in invitation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/members/invite",
        headers: authHeaders(ownerToken()),
        payload: { email: "invite@test.com", role: "owner" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/account/invitations — owner only
  // -----------------------------------------------------------------------

  describe("GET /api/account/invitations", () => {
    it("returns 200 for owner", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/invitations",
        headers: authHeaders(ownerToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 403 for editor", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/invitations",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
