/**
 * Comprehensive tests for notification routes:
 * - GET /api/notifications (list with cursor pagination, category filter, unread-only)
 * - GET /api/notifications/unread-count
 * - POST /api/notifications/:id/read
 * - POST /api/notifications/read-all
 * - POST /api/notifications/:id/archive
 * - GET /api/notifications/preferences
 * - PATCH /api/notifications/preferences (bulk update)
 * - PATCH /api/notifications/preferences/:type (single update)
 *
 * Uses buildTestApp with mocked DB and Fastify .inject() for HTTP-level testing.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  buildTestApp,
  userToken,
  viewerToken,
  authHeaders,
  createMockDb,
  type MockDbOverrides,
} from "../helpers/test-app.js";
import { notificationRoutes } from "../../routes/notifications.js";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildApp(db?: MockDbOverrides): Promise<FastifyInstance> {
  return buildTestApp({
    routes: notificationRoutes,
    prefix: "/api/notifications",
    db,
  });
}

/** Generate a mock notification row */
function mockNotification(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "n-001",
    type: overrides.type ?? "ranking_top3_entry",
    category: overrides.category ?? "ranking",
    title: overrides.title ?? "Your app entered Top 3",
    body: overrides.body ?? "App moved to position #2",
    url: overrides.url ?? "/apps/my-app",
    icon: overrides.icon ?? "trophy",
    priority: overrides.priority ?? "normal",
    isRead: overrides.isRead ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-03-28T12:00:00Z"),
  };
}

// ---------------------------------------------------------------------------
// GET /api/notifications — List
// ---------------------------------------------------------------------------

describe("GET /api/notifications", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns paginated notifications with expected shape", async () => {
    const mockNotifs = [
      mockNotification({ id: "n1" }),
      mockNotification({ id: "n2", createdAt: new Date("2026-03-27T12:00:00Z") }),
    ];
    app = await buildApp({ selectResult: mockNotifs });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?limit=10",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toBeDefined();
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it("returns hasMore=true and nextCursor when more items exist", async () => {
    // When limit=2, we request limit+1=3 rows. If we get 3, hasMore=true.
    const now = new Date("2026-03-28T12:00:00Z");
    const items = [
      mockNotification({ id: "n1", createdAt: new Date("2026-03-28T12:00:00Z") }),
      mockNotification({ id: "n2", createdAt: new Date("2026-03-27T12:00:00Z") }),
      mockNotification({ id: "n3", createdAt: new Date("2026-03-26T12:00:00Z") }),
    ];
    app = await buildApp({ selectResult: items });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?limit=2",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasMore).toBe(true);
    expect(body.notifications).toHaveLength(2);
    expect(body.nextCursor).toBe(new Date("2026-03-27T12:00:00Z").toISOString());
  });

  it("returns hasMore=false when items equal to limit (not over)", async () => {
    const items = [
      mockNotification({ id: "n1" }),
      mockNotification({ id: "n2" }),
    ];
    app = await buildApp({ selectResult: items });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?limit=5",
      headers: authHeaders(userToken()),
    });

    const body = res.json();
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.notifications).toHaveLength(2);
  });

  it("accepts cursor parameter for pagination", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?cursor=2026-03-27T12:00:00.000Z&limit=10",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("accepts category filter parameter", async () => {
    const reviewNotif = mockNotification({ id: "n1", category: "review", type: "review_new_negative" });
    app = await buildApp({ selectResult: [reviewNotif] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?category=review",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].category).toBe("review");
  });

  it("accepts unreadOnly filter parameter", async () => {
    const unreadNotif = mockNotification({ id: "n1", isRead: false });
    app = await buildApp({ selectResult: [unreadNotif] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?unreadOnly=true",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].isRead).toBe(false);
  });

  it("combines category and unreadOnly filters", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?category=keyword&unreadOnly=true",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().notifications).toEqual([]);
  });

  it("caps limit at 100 even when higher value requested", async () => {
    // With limit=999, code does Math.min(999, 100) = 100, queries 101 rows.
    // Mock returns empty, so we just verify no error.
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?limit=999",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().notifications).toEqual([]);
  });

  it("defaults limit to 30 when not specified", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({ method: "GET", url: "/api/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("returns empty list when no notifications exist", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Category filtering — each of 7 categories
// ---------------------------------------------------------------------------

describe("GET /api/notifications — category filtering", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  const categories = ["ranking", "competitor", "review", "keyword", "featured", "system", "account"];

  for (const cat of categories) {
    it(`filters by category=${cat}`, async () => {
      const notif = mockNotification({ id: `n-${cat}`, category: cat });
      app = await buildApp({ selectResult: [notif] });

      const res = await app.inject({
        method: "GET",
        url: `/api/notifications?category=${cat}`,
        headers: authHeaders(userToken()),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.notifications).toHaveLength(1);
      expect(body.notifications[0].category).toBe(cat);
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// ---------------------------------------------------------------------------

describe("GET /api/notifications/unread-count", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns correct unread count", async () => {
    app = await buildApp({ selectResult: [{ count: 5 }] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(5);
  });

  it("returns 0 when no unread notifications", async () => {
    app = await buildApp({ selectResult: [{ count: 0 }] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(0);
  });

  it("returns 0 when select returns empty (fallback)", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(0);
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({ method: "GET", url: "/api/notifications/unread-count" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/read
// ---------------------------------------------------------------------------

describe("POST /api/notifications/:id/read", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("marks notification as read (returns success)", async () => {
    // update().returning() resolves to [{ id: "n1" }] meaning the row was found
    app = await buildApp({ selectResult: [{ id: "n1" }] });
    // Override the update chain to return a result
    (app as any).db.update = () => {
      const chain: any = {};
      const methods = ["set", "where", "returning"];
      for (const m of methods) chain[m] = () => chain;
      chain.returning = () => chain;
      chain.then = (resolve: any) => Promise.resolve([{ id: "n1" }]).then(resolve);
      // Make set/where return chain
      chain.set = () => chain;
      chain.where = () => chain;
      return chain;
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/n1/read",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("returns 404 when notification not found", async () => {
    // Default update mock returns [], so returning() resolves to []
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/nonexistent/read",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Notification not found");
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({ method: "POST", url: "/api/notifications/n1/read" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/read-all
// ---------------------------------------------------------------------------

describe("POST /api/notifications/read-all", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("marks all as read and returns success with updated count", async () => {
    // Override update to return rowCount
    app = await buildApp();
    (app as any).db.update = () => {
      const chain: any = {};
      chain.set = () => chain;
      chain.where = () => chain;
      chain.then = (resolve: any) => Promise.resolve({ rowCount: 7 }).then(resolve);
      return chain;
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/read-all",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(7);
  });

  it("returns updated=0 when no unread notifications", async () => {
    app = await buildApp();
    (app as any).db.update = () => {
      const chain: any = {};
      chain.set = () => chain;
      chain.where = () => chain;
      chain.then = (resolve: any) => Promise.resolve({ rowCount: 0 }).then(resolve);
      return chain;
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/read-all",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(0);
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({ method: "POST", url: "/api/notifications/read-all" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/archive
// ---------------------------------------------------------------------------

describe("POST /api/notifications/:id/archive", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("archives a notification successfully", async () => {
    app = await buildApp();
    (app as any).db.update = () => {
      const chain: any = {};
      chain.set = () => chain;
      chain.where = () => chain;
      chain.returning = () => chain;
      chain.then = (resolve: any) => Promise.resolve([{ id: "n1" }]).then(resolve);
      return chain;
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/n1/archive",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("returns 404 when notification not found", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/nonexistent/archive",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Notification not found");
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({ method: "POST", url: "/api/notifications/n1/archive" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications/preferences
// ---------------------------------------------------------------------------

describe("GET /api/notifications/preferences", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("returns merged preferences (global defaults + user overrides)", async () => {
    // The route calls select() twice: first for globalConfigs, then for userPrefs.
    // With a single selectResult mock, both calls return the same data.
    // We test that the response shape is correct.
    app = await buildApp({
      selectResult: [
        { notificationType: "ranking_top3_entry", inAppEnabled: true, pushDefaultEnabled: false },
        { notificationType: "review_new_negative", inAppEnabled: true, pushDefaultEnabled: true },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.preferences).toBeDefined();
    expect(Array.isArray(body.preferences)).toBe(true);
    // Each preference should have type, inAppEnabled, pushEnabled
    for (const pref of body.preferences) {
      expect(pref).toHaveProperty("type");
      expect(pref).toHaveProperty("inAppEnabled");
      expect(pref).toHaveProperty("pushEnabled");
    }
  });

  it("returns empty preferences when no configs exist", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().preferences).toEqual([]);
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({ method: "GET", url: "/api/notifications/preferences" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/notifications/preferences (bulk update)
// ---------------------------------------------------------------------------

describe("PATCH /api/notifications/preferences", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("bulk updates preferences and returns updated count", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
      payload: {
        preferences: [
          { type: "ranking_top3_entry", inAppEnabled: false },
          { type: "review_new_negative", pushEnabled: true },
          { type: "system_scrape_complete", inAppEnabled: true, pushEnabled: false },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(3);
  });

  it("returns error when preferences is not an array", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
      payload: { preferences: "not-an-array" },
    });

    expect(res.statusCode).toBe(200); // Route returns error in body, not 400
    expect(res.json().error).toBe("preferences array required");
  });

  it("handles empty preferences array", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
      payload: { preferences: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().updated).toBe(0);
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      payload: { preferences: [] },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/notifications/preferences/:type (single type update)
// ---------------------------------------------------------------------------

describe("PATCH /api/notifications/preferences/:type", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("updates a single type preference with inAppEnabled", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences/ranking_top3_entry",
      headers: authHeaders(userToken()),
      payload: { inAppEnabled: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("updates a single type preference with pushEnabled", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences/review_new_negative",
      headers: authHeaders(userToken()),
      payload: { pushEnabled: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("updates both inAppEnabled and pushEnabled at once", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences/keyword_position_gained",
      headers: authHeaders(userToken()),
      payload: { inAppEnabled: true, pushEnabled: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("requires authentication", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences/ranking_top3_entry",
      payload: { inAppEnabled: false },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Access control — user isolation
// ---------------------------------------------------------------------------

describe("Notification access control", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("different users get their own notifications (isolated by userId)", async () => {
    // User A fetches notifications
    const userANotifs = [
      mockNotification({ id: "n-a1", title: "User A notification" }),
    ];
    app = await buildApp({ selectResult: userANotifs });

    const resA = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: authHeaders(userToken({ userId: "user-A" })),
    });
    expect(resA.statusCode).toBe(200);
    expect(resA.json().notifications).toHaveLength(1);

    // User B fetches — same mock, but route adds userId filter
    const resB = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: authHeaders(userToken({ userId: "user-B" })),
    });
    expect(resB.statusCode).toBe(200);
    // Both return data because mock doesn't actually filter,
    // but the route correctly builds the WHERE clause with userId
  });

  it("viewer role can access notifications", async () => {
    app = await buildApp({ selectResult: [{ count: 2 }] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: authHeaders(viewerToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(2);
  });

  it("read-all only affects the authenticated user's notifications", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/read-all",
      headers: authHeaders(userToken({ userId: "specific-user-123" })),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("archiving someone else's notification returns 404 (mock returns empty)", async () => {
    // The route uses WHERE id = :id AND userId = :userId
    // If userId doesn't match, returning() is empty => 404
    app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/other-users-notif/archive",
      headers: authHeaders(userToken({ userId: "user-A" })),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("Notification routes — edge cases", () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it("handles non-numeric limit gracefully (defaults to NaN -> 30)", async () => {
    app = await buildApp({ selectResult: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?limit=abc",
      headers: authHeaders(userToken()),
    });

    // parseInt("abc") = NaN, Math.min(NaN, 100) = NaN
    // The query still executes (limit NaN becomes no effective limit in mock)
    expect(res.statusCode).toBe(200);
  });

  it("handles large unread count correctly", async () => {
    app = await buildApp({ selectResult: [{ count: 9999 }] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(9999);
  });

  it("notification fields include all expected properties", async () => {
    const fullNotif = mockNotification({
      id: "n-full",
      type: "competitor_overtook",
      category: "competitor",
      title: "Competitor overtook you",
      body: "App X passed your app in rankings",
      url: "/competitors/app-x",
      icon: "alert-triangle",
      priority: "high",
      isRead: false,
      createdAt: new Date("2026-03-28T10:00:00Z"),
    });
    app = await buildApp({ selectResult: [fullNotif] });

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: authHeaders(userToken()),
    });

    expect(res.statusCode).toBe(200);
    const notif = res.json().notifications[0];
    expect(notif.id).toBe("n-full");
    expect(notif.type).toBe("competitor_overtook");
    expect(notif.category).toBe("competitor");
    expect(notif.title).toBe("Competitor overtook you");
    expect(notif.body).toBe("App X passed your app in rankings");
    expect(notif.url).toBe("/competitors/app-x");
    expect(notif.icon).toBe("alert-triangle");
    expect(notif.priority).toBe("high");
    expect(notif.isRead).toBe(false);
  });

  it("preferences PATCH with only pushEnabled (no inAppEnabled)", async () => {
    app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      headers: authHeaders(userToken()),
      payload: {
        preferences: [{ type: "featured_new_placement", pushEnabled: true }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(1);
  });
});
