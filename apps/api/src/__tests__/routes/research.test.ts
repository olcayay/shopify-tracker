import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildTestApp,
  createMockDb,
  userToken,
  adminToken,
  viewerToken,
  authHeaders,
} from "../helpers/test-app.js";
import type { FastifyInstance } from "fastify";

describe("Research routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { researchRoutes } = await import("../../routes/research.js");
    app = await buildTestApp({
      routes: researchRoutes,
      prefix: "/api/research-projects",
      db: {
        selectResult: [
          {
            id: "project-001",
            name: "Test Research",
            accountId: "account-001",
            platform: "shopify",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            creatorName: "Test User",
            count: 0,
            maxResearchProjects: 10,
            slug: "test-app",
            keyword: "test",
          },
        ],
        insertResult: [
          {
            id: "project-002",
            name: "New Research",
            accountId: "account-001",
            platform: "shopify",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Auth enforcement
  // -----------------------------------------------------------------------

  describe("auth enforcement", () => {
    it("returns 401 without token on GET /", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 without token on POST /", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects",
        payload: { name: "My Research" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects",
        headers: { authorization: "Bearer invalid-token" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 without Bearer prefix", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects",
        headers: { authorization: userToken() },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/research-projects
  // -----------------------------------------------------------------------

  describe("GET /api/research-projects", () => {
    it("returns projects with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts platform query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects?platform=shopify",
        headers: authHeaders(userToken()),
      });
      expect(res.statusCode).toBe(200);
    });

    it("allows viewer to list projects", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/research-projects
  // -----------------------------------------------------------------------

  describe("POST /api/research-projects", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects",
        payload: { name: "New Project" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects",
        headers: authHeaders(viewerToken()),
        payload: { name: "New Project" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("creates project for editor", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { name: "New Project" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it("creates project for owner", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects",
        headers: authHeaders(userToken({ role: "owner" })),
        payload: { name: "New Project" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it("creates project with default name when name is omitted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: {},
      });
      // Should not fail validation - defaults to "Untitled Research"
      expect(res.statusCode).not.toBe(400);
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /api/research-projects/:id
  // -----------------------------------------------------------------------

  describe("PATCH /api/research-projects/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/research-projects/project-001",
        payload: { name: "Renamed" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/research-projects/project-001",
        headers: authHeaders(viewerToken()),
        payload: { name: "Renamed" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 with empty name", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/research-projects/project-001",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { name: "" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Name is required");
    });

    it("returns 400 with whitespace-only name", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/research-projects/project-001",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { name: "   " },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/research-projects/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/research-projects/:id", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/research-projects/:id/keywords
  // -----------------------------------------------------------------------

  describe("POST /api/research-projects/:id/keywords", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/keywords",
        payload: { keyword: "seo tools" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/keywords",
        headers: authHeaders(viewerToken()),
        payload: { keyword: "seo tools" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when keyword is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/keywords",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Keyword is required");
    });

    it("returns 400 when keyword is empty string", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/keywords",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { keyword: "  " },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/research-projects/:id/keywords/:kwId
  // -----------------------------------------------------------------------

  describe("DELETE /api/research-projects/:id/keywords/:kwId", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001/keywords/1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001/keywords/1",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 with non-numeric keyword ID", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001/keywords/not-a-number",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Invalid keyword ID");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/research-projects/:id/competitors
  // -----------------------------------------------------------------------

  describe("POST /api/research-projects/:id/competitors", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/competitors",
        payload: { slug: "competitor-app" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/competitors",
        headers: authHeaders(viewerToken()),
        payload: { slug: "competitor-app" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when slug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/competitors",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("App slug is required");
    });

    it("returns 400 when slug is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/research-projects/project-001/competitors",
        headers: authHeaders(userToken({ role: "editor" })),
        payload: { slug: "  " },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/research-projects/:id/competitors/:slug
  // -----------------------------------------------------------------------

  describe("DELETE /api/research-projects/:id/competitors/:slug", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001/competitors/competitor-app",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for viewer role", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001/competitors/competitor-app",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/research-projects/project-001/competitors/competitor-app",
        headers: authHeaders(userToken({ role: "editor" })),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/research-projects/:id/data
  // -----------------------------------------------------------------------

  describe("GET /api/research-projects/:id/data", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects/project-001/data",
      });
      expect(res.statusCode).toBe(401);
    });

    it("allows viewer to access project data", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/research-projects/project-001/data",
        headers: authHeaders(viewerToken()),
      });
      // Viewer should be able to read data (no requireRole on GET)
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });
});
