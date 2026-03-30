import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { sqlArray } from "@appranks/db";

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

      // 1. Get tracked apps with basic info
      const trackedApps: any[] = await db.execute(sql`
        SELECT a.id, a.platform, a.slug, a.name, a.icon_url, a.average_rating, a.rating_count,
          (SELECT COUNT(*) FROM account_tracked_keywords atk
           JOIN tracked_keywords tk ON tk.id = atk.keyword_id
           WHERE atk.account_id = ${accountId} AND tk.platform = a.platform) AS keyword_count
        FROM apps a
        JOIN account_tracked_apps ata ON ata.app_id = a.id AND ata.account_id = ${accountId}
        ${platformFilter ? sql`WHERE a.platform = ${platformFilter}` : sql``}
        ORDER BY a.platform, a.name
      `);

      if (trackedApps.length === 0) return { platforms: {} };

      const appIds = trackedApps.map((a) => a.id);
      const platforms = [...new Set(trackedApps.map((a) => a.platform))];

      // 2. Top keyword movers — biggest absolute rank changes (latest vs previous snapshot)
      const keywordMovers: any[] = await db.execute(sql`
        WITH latest_ranks AS (
          SELECT DISTINCT ON (akr.app_id, akr.keyword_id)
            akr.app_id, akr.keyword_id, akr.position, akr.scraped_at
          FROM app_keyword_rankings akr
          WHERE akr.app_id = ANY(${sqlArray(appIds)})
          ORDER BY akr.app_id, akr.keyword_id, akr.scraped_at DESC
        ),
        prev_ranks AS (
          SELECT DISTINCT ON (akr.app_id, akr.keyword_id)
            akr.app_id, akr.keyword_id, akr.position
          FROM app_keyword_rankings akr
          WHERE akr.app_id = ANY(${sqlArray(appIds)})
            AND akr.scraped_at < (SELECT MIN(lr.scraped_at) FROM latest_ranks lr WHERE lr.app_id = akr.app_id AND lr.keyword_id = akr.keyword_id)
          ORDER BY akr.app_id, akr.keyword_id, akr.scraped_at DESC
        )
        SELECT lr.app_id, tk.keyword, pr.position AS old_position, lr.position AS new_position,
          (pr.position - lr.position) AS delta
        FROM latest_ranks lr
        JOIN prev_ranks pr ON pr.app_id = lr.app_id AND pr.keyword_id = lr.keyword_id
        JOIN tracked_keywords tk ON tk.id = lr.keyword_id
        WHERE pr.position != lr.position
        ORDER BY ABS(pr.position - lr.position) DESC
        LIMIT 10
      `);

      // 3. Top category movers
      const categoryMovers: any[] = await db.execute(sql`
        WITH latest_cat AS (
          SELECT DISTINCT ON (acr.app_id, acr.category_slug)
            acr.app_id, acr.category_slug, acr.position, acr.scraped_at
          FROM app_category_rankings acr
          WHERE acr.app_id = ANY(${sqlArray(appIds)})
          ORDER BY acr.app_id, acr.category_slug, acr.scraped_at DESC
        ),
        prev_cat AS (
          SELECT DISTINCT ON (acr.app_id, acr.category_slug)
            acr.app_id, acr.category_slug, acr.position
          FROM app_category_rankings acr
          WHERE acr.app_id = ANY(${sqlArray(appIds)})
            AND acr.scraped_at < (SELECT MIN(lc.scraped_at) FROM latest_cat lc WHERE lc.app_id = acr.app_id AND lc.category_slug = acr.category_slug)
          ORDER BY acr.app_id, acr.category_slug, acr.scraped_at DESC
        )
        SELECT lc.app_id, lc.category_slug AS category, pc.position AS old_position, lc.position AS new_position,
          (pc.position - lc.position) AS delta
        FROM latest_cat lc
        JOIN prev_cat pc ON pc.app_id = lc.app_id AND pc.category_slug = lc.category_slug
        WHERE pc.position != lc.position
        ORDER BY ABS(pc.position - lc.position) DESC
        LIMIT 10
      `);

      // 4. Review pulse — top apps by v7d review velocity
      const reviewPulse: any[] = await db.execute(sql`
        SELECT DISTINCT ON (arm.app_id)
          arm.app_id, arm.v7d, arm.v30d, arm.momentum, arm.average_rating
        FROM app_review_metrics arm
        WHERE arm.app_id = ANY(${sqlArray(appIds)})
          AND arm.v7d > 0
        ORDER BY arm.app_id, arm.computed_at DESC
      `);

      // 5. Recent listing changes (last 48h)
      const recentChanges: any[] = await db.execute(sql`
        SELECT afc.app_id, afc.field, afc.old_value, afc.new_value, afc.detected_at
        FROM app_field_changes afc
        WHERE afc.app_id = ANY(${sqlArray(appIds)})
          AND afc.detected_at >= NOW() - INTERVAL '48 hours'
        ORDER BY afc.detected_at DESC
        LIMIT 20
      `);

      // 6. Featured sightings (last 7 days)
      const featuredSightings: any[] = await db.execute(sql`
        SELECT fas.app_id, fas.section_title, fas.position, fas.seen_date
        FROM featured_app_sightings fas
        WHERE fas.app_id = ANY(${sqlArray(appIds)})
          AND fas.seen_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY fas.seen_date DESC, fas.position ASC
        LIMIT 20
      `);

      // 7. Competitor alerts — recent field changes in competitor apps (last 48h)
      const competitorAppIds: any[] = await db.execute(sql`
        SELECT DISTINCT aca.competitor_app_id
        FROM account_competitor_apps aca
        WHERE aca.account_id = ${accountId}
      `);
      const compIds = competitorAppIds.map((r) => r.competitor_app_id).filter(Boolean);

      let competitorAlerts: any[] = [];
      if (compIds.length > 0) {
        competitorAlerts = await db.execute(sql`
          SELECT afc.app_id AS competitor_id, afc.field, afc.old_value, afc.new_value, afc.detected_at,
            a.name AS competitor_name, a.slug AS competitor_slug, a.platform AS competitor_platform
          FROM app_field_changes afc
          JOIN apps a ON a.id = afc.app_id
          WHERE afc.app_id = ANY(${sqlArray(compIds)})
            AND afc.detected_at >= NOW() - INTERVAL '48 hours'
          ORDER BY afc.detected_at DESC
          LIMIT 20
        `);
      }

      // 8. Ad activity (last 7 days)
      const adActivity: any[] = await db.execute(sql`
        SELECT kas.app_id, tk.keyword, kas.seen_date
        FROM keyword_ad_sightings kas
        JOIN tracked_keywords tk ON tk.id = kas.keyword_id
        WHERE kas.app_id = ANY(${sqlArray(appIds)})
          AND kas.seen_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY kas.seen_date DESC
        LIMIT 20
      `);

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
          })),
          highlights: {
            keywordMovers: keywordMovers
              .filter((m) => platformAppIds.has(m.app_id))
              .slice(0, 5)
              .map((m) => ({
                app: appRef(m.app_id),
                keyword: m.keyword,
                oldPosition: m.old_position,
                newPosition: m.new_position,
                delta: Number(m.delta),
              })),
            categoryMovers: categoryMovers
              .filter((m) => platformAppIds.has(m.app_id))
              .slice(0, 5)
              .map((m) => ({
                app: appRef(m.app_id),
                category: m.category,
                oldPosition: m.old_position,
                newPosition: m.new_position,
                delta: Number(m.delta),
              })),
            reviewPulse: reviewPulse
              .filter((m) => platformAppIds.has(m.app_id))
              .sort((a, b) => (b.v7d || 0) - (a.v7d || 0))
              .slice(0, 5)
              .map((m) => ({
                app: appRef(m.app_id),
                v7d: Number(m.v7d || 0),
                v30d: Number(m.v30d || 0),
                momentum: m.momentum,
                latestRating: m.average_rating != null ? Number(m.average_rating) : null,
              })),
            recentChanges: recentChanges
              .filter((c) => platformAppIds.has(c.app_id))
              .slice(0, 5)
              .map((c) => ({
                app: appRef(c.app_id),
                field: c.field,
                oldValue: c.old_value,
                newValue: c.new_value,
                detectedAt: c.detected_at,
              })),
            featuredSightings: featuredSightings
              .filter((f) => platformAppIds.has(f.app_id))
              .slice(0, 5)
              .map((f) => ({
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
            adActivity: adActivity
              .filter((a) => platformAppIds.has(a.app_id))
              .slice(0, 5)
              .map((a) => ({
                app: appRef(a.app_id),
                keyword: a.keyword,
                seenDate: a.seen_date,
              })),
          },
        };
      }

      return { platforms: result };
    }
  );
}
