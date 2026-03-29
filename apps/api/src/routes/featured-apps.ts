import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import {
  featuredAppSightings,
  apps,
  accountTrackedApps,
  accountCompetitorApps,
} from "@appranks/db";
import { getPlatformFromQuery } from "../utils/platform.js";


export const featuredAppRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/featured-apps?days=30&surface=home|category&surfaceDetail=slug&surfaceDetailPrefix=slug
  app.get("/", async (request) => {
    const { days = "30", surface, surfaceDetail, surfaceDetailPrefix, limit = "500", offset = "0" } = request.query as {
      days?: string;
      surface?: string;
      surfaceDetail?: string;
      surfaceDetailPrefix?: string;
      limit?: string;
      offset?: string;
    };
    const maxLimit = Math.min(parseInt(limit, 10) || 500, 500);
    const parsedOffset = parseInt(offset, 10) || 0;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    const sinceStr = since.toISOString().slice(0, 10);

    const conditions = [
      sql`${featuredAppSightings.seenDate} >= ${sinceStr}`,
      eq(apps.platform, platform),
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
        appSlug: apps.slug,
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
      .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
      .where(and(...conditions))
      .orderBy(
        featuredAppSightings.surface,
        featuredAppSightings.surfaceDetail,
        featuredAppSightings.sectionHandle,
        desc(featuredAppSightings.seenDate)
      )
      .limit(maxLimit)
      .offset(parsedOffset);

    // Get tracked/competitor slugs for badges
    const { accountId } = request.user;
    const [trackedRows, competitorRows] = await Promise.all([
      db
        .select({ appSlug: apps.slug })
        .from(accountTrackedApps)
        .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
        .where(eq(accountTrackedApps.accountId, accountId)),
      db
        .select({ appSlug: apps.slug })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
        .where(eq(accountCompetitorApps.accountId, accountId)),
    ]);

    return {
      sightings: rows,
      trackedSlugs: trackedRows.map((r) => r.appSlug),
      competitorSlugs: competitorRows.map((r) => r.appSlug),
    };
  });

  // GET /api/featured-apps/my-apps?days=30&platform=shopify
  // Returns featured sightings only for tracked & competitor apps (all surfaces)
  app.get("/my-apps", async (request) => {
    const { days = "30", limit = "500", offset = "0" } = request.query as { days?: string; limit?: string; offset?: string };
    const myMaxLimit = Math.min(parseInt(limit, 10) || 500, 500);
    const myParsedOffset = parseInt(offset, 10) || 0;
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    const sinceStr = since.toISOString().slice(0, 10);

    const { accountId } = request.user;

    // Get tracked & competitor app IDs
    const [trackedRows, competitorRows] = await Promise.all([
      db
        .select({ appId: accountTrackedApps.appId, appSlug: apps.slug })
        .from(accountTrackedApps)
        .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
        .where(and(eq(accountTrackedApps.accountId, accountId), eq(apps.platform, platform))),
      db
        .select({ appId: accountCompetitorApps.competitorAppId, appSlug: apps.slug })
        .from(accountCompetitorApps)
        .innerJoin(apps, eq(apps.id, accountCompetitorApps.competitorAppId))
        .where(and(eq(accountCompetitorApps.accountId, accountId), eq(apps.platform, platform))),
    ]);

    const allAppIds = [
      ...trackedRows.map((r) => r.appId),
      ...competitorRows.map((r) => r.appId),
    ];

    if (allAppIds.length === 0) {
      return { sightings: [], trackedSlugs: [], competitorSlugs: [] };
    }

    const rows = await db
      .select({
        appSlug: apps.slug,
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
      .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
      .where(and(
        sql`${featuredAppSightings.seenDate} >= ${sinceStr}`,
        eq(apps.platform, platform),
        inArray(featuredAppSightings.appId, allAppIds),
      ))
      .orderBy(
        featuredAppSightings.surface,
        featuredAppSightings.surfaceDetail,
        featuredAppSightings.sectionHandle,
        desc(featuredAppSightings.seenDate)
      )
      .limit(myMaxLimit)
      .offset(myParsedOffset);

    return {
      sightings: rows,
      trackedSlugs: trackedRows.map((r) => r.appSlug),
      competitorSlugs: competitorRows.map((r) => r.appSlug),
    };
  });

  // GET /api/featured-apps/sections?days=30&platform=shopify
  app.get("/sections", async (request) => {
    const { days = "30" } = request.query as { days?: string };
    const platform = getPlatformFromQuery(request.query as Record<string, unknown>);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));
    const sinceStr = since.toISOString().slice(0, 10);

    const rows = await db
      .select({
        surface: featuredAppSightings.surface,
        surfaceDetail: featuredAppSightings.surfaceDetail,
        sectionHandle: featuredAppSightings.sectionHandle,
        sectionTitle: featuredAppSightings.sectionTitle,
        appCount: sql<number>`count(distinct ${featuredAppSightings.appId})`,
        daysActive: sql<number>`count(distinct ${featuredAppSightings.seenDate})`,
        lastSeen: sql<string>`max(${featuredAppSightings.seenDate})`,
      })
      .from(featuredAppSightings)
      .innerJoin(apps, eq(apps.id, featuredAppSightings.appId))
      .where(and(
        sql`${featuredAppSightings.seenDate} >= ${sinceStr}`,
        eq(apps.platform, platform),
      ))
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
