import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and } from "drizzle-orm";
import { createDb } from "@shopify-tracking/db";
import {
  featuredAppSightings,
  apps,
  accountTrackedApps,
  accountCompetitorApps,
} from "@shopify-tracking/db";

type Db = ReturnType<typeof createDb>;

export const featuredAppRoutes: FastifyPluginAsync = async (app) => {
  const db: Db = (app as any).db;

  // GET /api/featured-apps?days=30&surface=home|category&surfaceDetail=slug&surfaceDetailPrefix=slug
  app.get("/", async (request) => {
    const { days = "30", surface, surfaceDetail, surfaceDetailPrefix } = request.query as {
      days?: string;
      surface?: string;
      surfaceDetail?: string;
      surfaceDetailPrefix?: string;
    };
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    const sinceStr = since.toISOString().slice(0, 10);

    const conditions = [
      sql`${featuredAppSightings.seenDate} >= ${sinceStr}`,
    ];
    if (surface) {
      conditions.push(eq(featuredAppSightings.surface, surface));
    }
    if (surfaceDetail) {
      conditions.push(eq(featuredAppSightings.surfaceDetail, surfaceDetail));
    }
    if (surfaceDetailPrefix) {
      conditions.push(
        sql`${featuredAppSightings.surfaceDetail} LIKE ${surfaceDetailPrefix + "%"}`
      );
    }

    const rows = await db
      .select({
        appSlug: featuredAppSightings.appSlug,
        appName: apps.name,
        iconUrl: apps.iconUrl,
        surface: featuredAppSightings.surface,
        surfaceDetail: featuredAppSightings.surfaceDetail,
        sectionHandle: featuredAppSightings.sectionHandle,
        sectionTitle: featuredAppSightings.sectionTitle,
        position: featuredAppSightings.position,
        seenDate: featuredAppSightings.seenDate,
        timesSeenInDay: featuredAppSightings.timesSeenInDay,
      })
      .from(featuredAppSightings)
      .innerJoin(apps, eq(apps.slug, featuredAppSightings.appSlug))
      .where(and(...conditions))
      .orderBy(
        featuredAppSightings.surface,
        featuredAppSightings.surfaceDetail,
        featuredAppSightings.sectionHandle,
        desc(featuredAppSightings.seenDate)
      );

    // Get tracked/competitor slugs for badges
    const { accountId } = request.user;
    const [trackedRows, competitorRows] = await Promise.all([
      db
        .select({ appSlug: accountTrackedApps.appSlug })
        .from(accountTrackedApps)
        .where(eq(accountTrackedApps.accountId, accountId)),
      db
        .select({ appSlug: accountCompetitorApps.appSlug })
        .from(accountCompetitorApps)
        .where(eq(accountCompetitorApps.accountId, accountId)),
    ]);

    return {
      sightings: rows,
      trackedSlugs: trackedRows.map((r) => r.appSlug),
      competitorSlugs: competitorRows.map((r) => r.appSlug),
    };
  });

  // GET /api/featured-apps/sections?days=30
  app.get("/sections", async (request) => {
    const { days = "30" } = request.query as { days?: string };
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    const sinceStr = since.toISOString().slice(0, 10);

    const rows = await db
      .select({
        surface: featuredAppSightings.surface,
        surfaceDetail: featuredAppSightings.surfaceDetail,
        sectionHandle: featuredAppSightings.sectionHandle,
        sectionTitle: featuredAppSightings.sectionTitle,
        appCount: sql<number>`count(distinct ${featuredAppSightings.appSlug})`,
        daysActive: sql<number>`count(distinct ${featuredAppSightings.seenDate})`,
        lastSeen: sql<string>`max(${featuredAppSightings.seenDate})`,
      })
      .from(featuredAppSightings)
      .where(sql`${featuredAppSightings.seenDate} >= ${sinceStr}`)
      .groupBy(
        featuredAppSightings.surface,
        featuredAppSightings.surfaceDetail,
        featuredAppSightings.sectionHandle,
        featuredAppSightings.sectionTitle
      )
      .orderBy(
        featuredAppSightings.surface,
        featuredAppSightings.surfaceDetail,
        featuredAppSightings.sectionHandle
      );

    return rows;
  });
};
