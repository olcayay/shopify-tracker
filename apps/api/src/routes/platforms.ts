import type { FastifyInstance, FastifyRequest } from "fastify";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";

export async function platformRoutes(app: FastifyInstance) {
  const db = app.db;

  // GET /api/platforms — list all platforms with capabilities
  app.get("/", async () => {
    return PLATFORM_IDS.map((id) => ({
      id: PLATFORMS[id].id,
      name: PLATFORMS[id].name,
      baseUrl: PLATFORMS[id].baseUrl,
      capabilities: {
        hasKeywordSearch: PLATFORMS[id].hasKeywordSearch,
        hasReviews: PLATFORMS[id].hasReviews,
        hasFeaturedSections: PLATFORMS[id].hasFeaturedSections,
        hasAdTracking: PLATFORMS[id].hasAdTracking,
        hasSimilarApps: PLATFORMS[id].hasSimilarApps,
        hasAutoSuggestions: PLATFORMS[id].hasAutoSuggestions,
        hasFeatureTaxonomy: PLATFORMS[id].hasFeatureTaxonomy,
      },
    }));
  });

  // GET /api/platforms/:id — single platform details
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply
    ) => {
      const { id } = request.params;
      const platform = PLATFORMS[id as PlatformId];
      if (!platform) {
        return reply.code(404).send({ error: "Platform not found" });
      }
      return {
        id: platform.id,
        name: platform.name,
        baseUrl: platform.baseUrl,
        capabilities: {
          hasKeywordSearch: platform.hasKeywordSearch,
          hasReviews: platform.hasReviews,
          hasFeaturedSections: platform.hasFeaturedSections,
          hasAdTracking: platform.hasAdTracking,
          hasSimilarApps: platform.hasSimilarApps,
          hasAutoSuggestions: platform.hasAutoSuggestions,
          hasFeatureTaxonomy: platform.hasFeatureTaxonomy,
        },
      };
    }
  );
}
