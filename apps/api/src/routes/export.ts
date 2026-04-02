import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, inArray, desc } from "drizzle-orm";
import {
  apps,
  accountTrackedApps,
  accountTrackedKeywords,
  trackedKeywords,
  appSnapshots,
  keywordSnapshots,
  accountPlatforms,
} from "@appranks/db";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  }
  return lines.join("\n");
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // GET /api/export/tracked-apps — CSV of all tracked apps with latest metrics
  app.get("/tracked-apps", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const accountId = request.user.accountId;

    // Get enabled platforms
    const enabledPlatforms = await db
      .select({ platform: accountPlatforms.platform })
      .from(accountPlatforms)
      .where(eq(accountPlatforms.accountId, accountId));
    const platformList = enabledPlatforms.map((p) => p.platform);
    if (platformList.length === 0) {
      reply.header("content-type", "text/csv");
      reply.header("content-disposition", 'attachment; filename="tracked-apps.csv"');
      return "name,platform,slug,rating,reviewCount,installCount\n";
    }

    const rows = await db
      .select({
        name: apps.name,
        platform: apps.platform,
        slug: apps.slug,
        averageRating: apps.averageRating,
        ratingCount: apps.ratingCount,
        activeInstalls: apps.activeInstalls,
        pricingHint: apps.pricingHint,
        firstTrackedAt: accountTrackedApps.createdAt,
      })
      .from(accountTrackedApps)
      .innerJoin(apps, eq(apps.id, accountTrackedApps.appId))
      .where(
        and(
          eq(accountTrackedApps.accountId, accountId),
          inArray(apps.platform, platformList),
        )
      );

    const headers = ["name", "platform", "slug", "averageRating", "ratingCount", "activeInstalls", "pricingHint", "firstTrackedAt"];
    const csv = toCsv(headers, rows as any[]);

    reply.header("content-type", "text/csv");
    reply.header("content-disposition", 'attachment; filename="tracked-apps.csv"');
    return csv;
  });

  // GET /api/export/keywords — CSV of all tracked keywords with latest rankings
  app.get("/keywords", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const accountId = request.user.accountId;

    const rows = await db
      .select({
        keyword: trackedKeywords.keyword,
        platform: trackedKeywords.platform,
        slug: trackedKeywords.slug,
        createdAt: accountTrackedKeywords.createdAt,
      })
      .from(accountTrackedKeywords)
      .innerJoin(trackedKeywords, eq(trackedKeywords.id, accountTrackedKeywords.keywordId))
      .where(eq(accountTrackedKeywords.accountId, accountId));

    const headers = ["keyword", "platform", "slug", "createdAt"];
    const csv = toCsv(headers, rows as any[]);

    reply.header("content-type", "text/csv");
    reply.header("content-disposition", 'attachment; filename="tracked-keywords.csv"');
    return csv;
  });
};
