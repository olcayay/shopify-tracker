/**
 * AI content generation API endpoints (PLA-328, PLA-329).
 * Admin-only endpoints for generating SEO content and review sentiment analysis.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq, sql, desc } from "drizzle-orm";
import { apps, appSnapshots } from "@appranks/db";

export const aiContentRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  // POST /ai/generate-content — Generate SEO content for a page
  app.post<{
    Body: {
      type: "comparison" | "category_overview" | "best_of_intro" | "app_description";
      context: Record<string, unknown>;
    };
  }>("/generate-content", async (request, reply) => {
    const { type, context } = request.body;
    if (!type || !context) {
      return reply.code(400).send({ error: "type and context are required" });
    }

    const { generateContent } = await import("../services/ai-content.js");
    const result = await generateContent({
      db,
      type,
      context,
      userId: request.user.userId,
      accountId: request.user.accountId,
    });

    if (!result) {
      return reply.code(503).send({ error: "AI generation unavailable" });
    }

    return result;
  });

  // POST /ai/analyze-reviews — Analyze sentiment for an app's reviews
  app.post<{
    Body: { appSlug: string; platform: string };
  }>("/analyze-reviews", async (request, reply) => {
    const { appSlug, platform } = request.body;
    if (!appSlug || !platform) {
      return reply.code(400).send({ error: "appSlug and platform are required" });
    }

    // Fetch app reviews
    const reviewRows = await db.execute(sql`
      SELECT r.body, r.rating, r.reviewer_name AS author
      FROM reviews r
      JOIN apps a ON a.id = r.app_id
      WHERE a.slug = ${appSlug} AND a.platform = ${platform}
        AND r.body IS NOT NULL AND r.body != ''
      ORDER BY r.created_at DESC
      LIMIT 30
    `);
    const reviews = ((reviewRows as any).rows ?? reviewRows) as { body: string; rating: number; author?: string }[];

    if (reviews.length === 0) {
      return reply.code(404).send({ error: "No reviews found for this app" });
    }

    const { analyzeReviewSentiment } = await import("../services/review-sentiment.js");
    const result = await analyzeReviewSentiment(db, appSlug, reviews, {
      userId: request.user.userId,
      accountId: request.user.accountId,
    });

    if (!result) {
      // Fallback to rule-based
      const { quickSentiment } = await import("../services/review-sentiment.js");
      const quick = quickSentiment(reviews);
      return {
        appName: appSlug,
        overallSentiment: quick.sentiment,
        averageScore: quick.avgRating > 3 ? (quick.avgRating - 3) / 2 : (quick.avgRating - 3) / 3,
        topPros: [],
        topCons: [],
        summary: `Based on ${reviews.length} reviews with an average rating of ${quick.avgRating.toFixed(1)}★.`,
        reviewCount: reviews.length,
        source: "rule-based",
      };
    }

    return { ...result, source: "ai" };
  });

  // POST /ai/generate-comparison — Generate comparison content for two apps
  app.post<{
    Body: { platform: string; slug1: string; slug2: string };
  }>("/generate-comparison", async (request, reply) => {
    const { platform, slug1, slug2 } = request.body;
    if (!platform || !slug1 || !slug2) {
      return reply.code(400).send({ error: "platform, slug1, and slug2 are required" });
    }

    // Fetch both apps
    const appRows = await db.execute(sql`
      SELECT a.slug, a.name, a.average_rating, a.rating_count, a.pricing_hint,
             s.features, s.categories
      FROM apps a
      LEFT JOIN LATERAL (
        SELECT features, categories FROM app_snapshots WHERE app_id = a.id ORDER BY scraped_at DESC LIMIT 1
      ) s ON true
      WHERE a.platform = ${platform} AND a.slug IN (${slug1}, ${slug2})
    `);
    const rows = ((appRows as any).rows ?? appRows) as any[];
    const app1 = rows.find((r: any) => r.slug === slug1);
    const app2 = rows.find((r: any) => r.slug === slug2);

    if (!app1 || !app2) {
      return reply.code(404).send({ error: "One or both apps not found" });
    }

    const { generateContent } = await import("../services/ai-content.js");
    const result = await generateContent({
      db,
      type: "comparison",
      context: {
        app1Name: app1.name,
        app1Rating: app1.average_rating,
        app1Reviews: app1.rating_count,
        app1Pricing: app1.pricing_hint,
        app1Features: JSON.stringify(app1.features?.slice(0, 10) || []),
        app2Name: app2.name,
        app2Rating: app2.average_rating,
        app2Reviews: app2.rating_count,
        app2Pricing: app2.pricing_hint,
        app2Features: JSON.stringify(app2.features?.slice(0, 10) || []),
        platform,
      },
      userId: request.user.userId,
      accountId: request.user.accountId,
    });

    if (!result) {
      return reply.code(503).send({ error: "AI generation unavailable" });
    }

    return result;
  });
};
