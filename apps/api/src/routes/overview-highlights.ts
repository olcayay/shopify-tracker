import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { sqlArray } from "@appranks/db";
import { cacheGet } from "../utils/cache.js";

export async function overviewHighlightsRoutes(app: FastifyInstance) {
  const db = app.db;

  // GET /api/overview/highlights — per-platform highlight data for the overview page
  app.get(
    "/highlights",
    async (
      request: FastifyRequest<{
        Querystring: { platform?: string };
      }>
    ) => {
      const accountId = (request as any).user?.accountId || null;
      if (!accountId) return { platforms: {} };

      const platformFilter = request.query.platform?.trim() || "";

      return cacheGet(`overview-highlights:${accountId}:${platformFilter}`, async () => {
      // 1. Get tracked apps with basic info (CTE for keyword counts to avoid N+1)
      const trackedApps: any[] = await db.execute(sql`
        WITH kw_counts AS (
          SELECT atk.tracked_app_id, COUNT(DISTINCT atk.keyword_id) AS keyword_count
          FROM account_tracked_keywords atk
          WHERE atk.account_id = ${accountId}
          GROUP BY atk.tracked_app_id
        ),
        comp_counts AS (
          SELECT aca.tracked_app_id, COUNT(*) AS competitor_count
          FROM account_competitor_apps aca
          WHERE aca.account_id = ${accountId}
          GROUP BY aca.tracked_app_id
        ),
        dev_names AS (
          SELECT DISTINCT ON (s.app_id) s.app_id, s.developer->>'name' AS developer_name
          FROM app_snapshots s
          JOIN account_tracked_apps ata2 ON ata2.app_id = s.app_id AND ata2.account_id = ${accountId}
          ORDER BY s.app_id, s.scraped_at DESC
        )
        SELECT a.id, a.platform, a.slug, a.name, a.icon_url, a.average_rating, a.rating_count,
          COALESCE(kc.keyword_count, 0) AS keyword_count,
          COALESCE(cc.competitor_count, 0) AS competitor_count,
          dn.developer_name
        FROM apps a
        JOIN account_tracked_apps ata ON ata.app_id = a.id AND ata.account_id = ${accountId}
        LEFT JOIN kw_counts kc ON kc.tracked_app_id = a.id
        LEFT JOIN comp_counts cc ON cc.tracked_app_id = a.id
        LEFT JOIN dev_names dn ON dn.app_id = a.id
        ${platformFilter ? sql`WHERE a.platform = ${platformFilter}` : sql``}
        ORDER BY a.platform, a.name
      `);

      if (trackedApps.length === 0) return { platforms: {} };

      const appIds = trackedApps.map((a) => a.id);
      const platforms = [...new Set(trackedApps.map((a) => a.platform))];

      // Batch 1: lighter queries (4 connections max)
      const [
        reviewPulse,
        recentChanges,
        featuredSightings,
        competitorAppIdsRaw,
      ] = await Promise.all<any[]>([
        // 4. Review pulse
        db.execute(sql`
          SELECT DISTINCT ON (arm.app_id)
            arm.app_id, arm.v7d, arm.v30d, arm.momentum, arm.average_rating
          FROM app_review_metrics arm
          WHERE arm.app_id = ANY(${sqlArray(appIds)})
            AND arm.v7d > 0
          ORDER BY arm.app_id, arm.computed_at DESC
        `),
        // 5. Recent listing changes (last 48h)
        db.execute(sql`
          SELECT afc.app_id, afc.field, afc.old_value, afc.new_value, afc.detected_at
          FROM app_field_changes afc
          WHERE afc.app_id = ANY(${sqlArray(appIds)})
            AND afc.detected_at >= NOW() - INTERVAL '48 hours'
            AND NOT EXISTS (
              SELECT 1 FROM app_update_label_assignments ula
              JOIN app_update_labels aul ON aul.id = ula.label_id
              WHERE ula.change_id = afc.id AND aul.is_dismissal = TRUE
            )
          ORDER BY afc.detected_at DESC
          LIMIT 20
        `),
        // 6. Featured sightings (last 7 days)
        db.execute(sql`
          SELECT fas.app_id, fas.section_title, fas.position, fas.seen_date
          FROM featured_app_sightings fas
          WHERE fas.app_id = ANY(${sqlArray(appIds)})
            AND fas.seen_date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY fas.seen_date DESC, fas.position ASC
          LIMIT 20
        `),
        // 7a. Competitor app IDs
        db.execute(sql`
          SELECT DISTINCT aca.competitor_app_id
          FROM account_competitor_apps aca
          WHERE aca.account_id = ${accountId}
        `),
      ]);

      // Batch 2: heavy window function queries (3 connections max)
      const [
        keywordMovers,
        categoryMovers,
        adActivity,
      ] = await Promise.all<any[]>([
        // 2. Top keyword movers — window function with 14-day time bound
        db.execute(sql`
          WITH ranked AS (
            SELECT akr.app_id, akr.keyword_id, akr.position, akr.scraped_at,
              ROW_NUMBER() OVER (PARTITION BY akr.app_id, akr.keyword_id ORDER BY akr.scraped_at DESC) AS rn
            FROM app_keyword_rankings akr
            WHERE akr.app_id = ANY(${sqlArray(appIds)})
              AND akr.scraped_at >= NOW() - INTERVAL '14 days'
          )
          SELECT lr.app_id, tk.keyword, pr.position AS old_position, lr.position AS new_position,
            (pr.position - lr.position) AS delta
          FROM ranked lr
          JOIN ranked pr ON pr.app_id = lr.app_id AND pr.keyword_id = lr.keyword_id AND pr.rn = 2
          JOIN tracked_keywords tk ON tk.id = lr.keyword_id
          WHERE lr.rn = 1 AND lr.position IS NOT NULL AND pr.position IS NOT NULL AND pr.position != lr.position
          ORDER BY ABS(pr.position - lr.position) DESC
          LIMIT 10
        `),
        // 3. Top category movers — window function with 14-day time bound
        db.execute(sql`
          WITH ranked AS (
            SELECT acr.app_id, acr.category_slug, acr.position, acr.scraped_at,
              ROW_NUMBER() OVER (PARTITION BY acr.app_id, acr.category_slug ORDER BY acr.scraped_at DESC) AS rn
            FROM app_category_rankings acr
            WHERE acr.app_id = ANY(${sqlArray(appIds)})
              AND acr.scraped_at >= NOW() - INTERVAL '14 days'
          )
          SELECT lr.app_id, lr.category_slug AS category, pr.position AS old_position, lr.position AS new_position,
            (pr.position - lr.position) AS delta
          FROM ranked lr
          JOIN ranked pr ON pr.app_id = lr.app_id AND pr.category_slug = lr.category_slug AND pr.rn = 2
          WHERE lr.rn = 1 AND lr.position IS NOT NULL AND pr.position IS NOT NULL AND pr.position != lr.position
          ORDER BY ABS(pr.position - lr.position) DESC
          LIMIT 10
        `),
        // 8. Ad activity (last 7 days)
        db.execute(sql`
          SELECT kas.app_id, tk.keyword, kas.seen_date
          FROM keyword_ad_sightings kas
          JOIN tracked_keywords tk ON tk.id = kas.keyword_id
          WHERE kas.app_id = ANY(${sqlArray(appIds)})
            AND kas.seen_date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY kas.seen_date DESC
          LIMIT 20
        `),
      ]);

      // Cast Promise.all results (db.execute returns unknown[])
      const kwMovers = keywordMovers as any[];
      const catMovers = categoryMovers as any[];
      const revPulse = reviewPulse as any[];
      const changes = recentChanges as any[];
      const featured = featuredSightings as any[];
      const ads = adActivity as any[];

      // 7b. Competitor alerts (depends on competitor IDs from above)
      const compIds = (competitorAppIdsRaw as any[]).map((r) => r.competitor_app_id).filter(Boolean);
      let competitorAlerts: any[] = [];
      if (compIds.length > 0) {
        competitorAlerts = await db.execute(sql`
          SELECT afc.app_id AS competitor_id, afc.field, afc.old_value, afc.new_value, afc.detected_at,
            a.name AS competitor_name, a.slug AS competitor_slug, a.platform AS competitor_platform
          FROM app_field_changes afc
          JOIN apps a ON a.id = afc.app_id
          WHERE afc.app_id = ANY(${sqlArray(compIds)})
            AND afc.detected_at >= NOW() - INTERVAL '48 hours'
            AND NOT EXISTS (
              SELECT 1 FROM app_update_label_assignments ula
              JOIN app_update_labels aul ON aul.id = ula.label_id
              WHERE ula.change_id = afc.id AND aul.is_dismissal = TRUE
            )
          ORDER BY afc.detected_at DESC
          LIMIT 20
        `);
      }

      // Build app lookup
      const appLookup = new Map(trackedApps.map((a) => [a.id, a]));

      // Helper to get app summary ref
      function appRef(appId: number) {
        const a = appLookup.get(appId);
        return a ? { slug: a.slug, name: a.name, platform: a.platform, iconUrl: a.icon_url } : null;
      }

      // Group everything by platform
      const result: Record<string, any> = {};

      for (const platform of platforms) {
        const platformApps = trackedApps.filter((a) => a.platform === platform);
        const platformAppIds = new Set(platformApps.map((a) => a.id));

        result[platform] = {
          apps: platformApps.map((a) => ({
            slug: a.slug,
            name: a.name,
            iconUrl: a.icon_url,
            rating: a.average_rating != null ? Number(a.average_rating) : null,
            reviewCount: Number(a.rating_count || 0),
            keywordCount: Number(a.keyword_count || 0),
            competitorCount: Number(a.competitor_count || 0),
            developerName: a.developer_name || null,
          })),
          highlights: {
            keywordMovers: kwMovers
              .filter((m: any) => platformAppIds.has(m.app_id))
              .slice(0, 5)
              .map((m: any) => ({
                app: appRef(m.app_id),
                keyword: m.keyword,
                oldPosition: m.old_position,
                newPosition: m.new_position,
                delta: Number(m.delta),
              })),
            categoryMovers: catMovers
              .filter((m: any) => platformAppIds.has(m.app_id))
              .slice(0, 5)
              .map((m: any) => ({
                app: appRef(m.app_id),
                category: m.category,
                oldPosition: m.old_position,
                newPosition: m.new_position,
                delta: Number(m.delta),
              })),
            reviewPulse: revPulse
              .filter((m: any) => platformAppIds.has(m.app_id))
              .sort((a: any, b: any) => (b.v7d || 0) - (a.v7d || 0))
              .slice(0, 5)
              .map((m: any) => ({
                app: appRef(m.app_id),
                v7d: Number(m.v7d || 0),
                v30d: Number(m.v30d || 0),
                momentum: m.momentum,
                latestRating: m.average_rating != null ? Number(m.average_rating) : null,
              })),
            recentChanges: changes
              .filter((c: any) => platformAppIds.has(c.app_id))
              .slice(0, 5)
              .map((c: any) => ({
                app: appRef(c.app_id),
                field: c.field,
                oldValue: c.old_value,
                newValue: c.new_value,
                detectedAt: c.detected_at,
              })),
            featuredSightings: featured
              .filter((f: any) => platformAppIds.has(f.app_id))
              .slice(0, 5)
              .map((f: any) => ({
                app: appRef(f.app_id),
                sectionTitle: f.section_title,
                position: f.position,
                seenDate: f.seen_date,
              })),
            competitorAlerts: competitorAlerts
              .filter((c) => {
                // Only include alerts for competitors relevant to this platform's tracked apps
                return c.competitor_platform === platform;
              })
              .slice(0, 5)
              .map((c) => ({
                competitor: { slug: c.competitor_slug, name: c.competitor_name, platform: c.competitor_platform },
                field: c.field,
                oldValue: c.old_value,
                newValue: c.new_value,
                detectedAt: c.detected_at,
              })),
            adActivity: ads
              .filter((a: any) => platformAppIds.has(a.app_id))
              .slice(0, 5)
              .map((a: any) => ({
                app: appRef(a.app_id),
                keyword: a.keyword,
                seenDate: a.seen_date,
              })),
          },
        };
      }

      return { platforms: result };
      }, 60);
    }
  );
}
