import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  buildTestApp,
  userToken,
  viewerToken,
  authHeaders,
} from "../helpers/test-app.js";
import { accountExtrasRoutes } from "../../routes/account-extras.js";

describe("Account Extras Routes", () => {
  let app: FastifyInstance;
  const ownerToken = () => userToken({ role: "owner" });
  const editorToken = () => userToken({ role: "editor" });

  beforeAll(async () => {
    app = await buildTestApp({
      routes: accountExtrasRoutes,
      prefix: "/api/account",
      db: {
        selectResult: [
          {
            id: "cat-1",
            slug: "productivity",
            title: "Productivity",
            platform: "shopify",
            parentSlug: null,
            isListingPage: true,
          },
        ],
        insertResult: [
          {
            id: "result-1",
            accountId: "account-001",
            categoryId: "cat-1",
            featureHandle: "seo-check",
            featureTitle: "SEO Check",
            tagId: "tag-1",
            name: "Important",
            color: "red",
            createdAt: new Date().toISOString(),
          },
        ],
        executeResult: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Starred Categories
  // -----------------------------------------------------------------------

  describe("POST /api/account/starred-categories", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-categories?platform=shopify",
        headers: authHeaders(viewerToken()),
        payload: { slug: "productivity" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when slug is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-categories?platform=shopify",
        headers: authHeaders(editorToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid slug from editor", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-categories?platform=shopify",
        headers: authHeaders(editorToken()),
        payload: { slug: "productivity" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe("DELETE /api/account/starred-categories/:slug", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/starred-categories/productivity?platform=shopify",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/starred-categories/productivity?platform=shopify",
        headers: authHeaders(editorToken()),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Starred Features
  // -----------------------------------------------------------------------

  describe("POST /api/account/starred-features", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-features",
        headers: authHeaders(viewerToken()),
        payload: { handle: "seo-check", title: "SEO Check" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when handle is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-features",
        headers: authHeaders(editorToken()),
        payload: { title: "SEO Check" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when title is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-features",
        headers: authHeaders(editorToken()),
        payload: { handle: "seo-check" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid data from editor", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/starred-features",
        headers: authHeaders(editorToken()),
        payload: { handle: "seo-check", title: "SEO Check" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe("DELETE /api/account/starred-features/:handle", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/starred-features/seo-check",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Keyword Tags
  // -----------------------------------------------------------------------

  describe("GET /api/account/keyword-tags", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/keyword-tags",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 for authenticated user (any role)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/account/keyword-tags",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/account/keyword-tags", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/keyword-tags",
        headers: authHeaders(viewerToken()),
        payload: { name: "Priority", color: "red" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 with invalid color", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/keyword-tags",
        headers: authHeaders(editorToken()),
        payload: { name: "Priority", color: "invalid-color" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when name is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/keyword-tags",
        headers: authHeaders(editorToken()),
        payload: { color: "red" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid tag from editor", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/keyword-tags",
        headers: authHeaders(editorToken()),
        payload: { name: "Priority", color: "red" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe("PATCH /api/account/keyword-tags/:id", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/keyword-tags/tag-1",
        headers: authHeaders(viewerToken()),
        payload: { color: "blue" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 400 with empty body", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/keyword-tags/tag-1",
        headers: authHeaders(editorToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid color update", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/account/keyword-tags/tag-1",
        headers: authHeaders(editorToken()),
        payload: { color: "blue" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe("DELETE /api/account/keyword-tags/:id", () => {
    it("returns 403 for viewer", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/keyword-tags/tag-1",
        headers: authHeaders(viewerToken()),
      });
      expect(res.statusCode).toBe(403);
    });

    it("accepts delete from editor", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/account/keyword-tags/tag-1",
        headers: authHeaders(editorToken()),
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Platform Requests
  // -----------------------------------------------------------------------

  describe("POST /api/account/platform-requests", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/platform-requests",
        payload: { platformName: "Freshdesk" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when platformName is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/platform-requests",
        headers: authHeaders(editorToken()),
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when platformName is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/platform-requests",
        headers: authHeaders(editorToken()),
        payload: { platformName: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid platform request from any authenticated user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/platform-requests",
        headers: authHeaders(viewerToken()),
        payload: { platformName: "Freshdesk" },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it("accepts optional marketplaceUrl and notes", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/account/platform-requests",
        headers: authHeaders(editorToken()),
        payload: {
          platformName: "Freshdesk",
          marketplaceUrl: "https://freshdesk.com/marketplace",
          notes: "We need this platform",
        },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(400);
    });
  });
});
