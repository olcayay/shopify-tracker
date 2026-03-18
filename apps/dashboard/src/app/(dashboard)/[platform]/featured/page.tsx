import { getFeaturedApps, getFeaturedSections, getCategories } from "@/lib/api";
import { FeaturedTabs } from "./featured-tabs";
import { PLATFORMS, type PlatformId } from "@appranks/shared";

export default async function FeaturedPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const platformName = PLATFORMS[platform as PlatformId]?.name ?? platform;

  const [homeData, sections, allCategories] = await Promise.all([
    getFeaturedApps(30, "home", undefined, undefined, platform as PlatformId).catch(() => ({
      sightings: [],
      trackedSlugs: [],
      competitorSlugs: [],
    })),
    getFeaturedSections(30, platform as PlatformId).catch(() => []),
    getCategories("flat", platform as PlatformId).catch(() => []),
  ]);

  // Build L1 category options from sections that have featured data
  const categorySlugsWithData = new Set(
    sections
      .filter((s: any) => s.surface === "category")
      .map((s: any) => s.surfaceDetail)
  );

  // Find top-level (L0) categories that have featured data (self or children)
  const l0Categories = allCategories
    .filter((c: any) => c.categoryLevel === 0)
    .filter((c: any) =>
      [...categorySlugsWithData].some(
        (slug: string) => slug === c.slug || slug.startsWith(c.slug + "-")
      )
    )
    .map((c: any) => ({ slug: c.slug, title: c.title }))
    .sort((a: any, b: any) => a.title.localeCompare(b.title));

  // Build slug -> title map for all categories (used for group headings)
  const categoryTitles: Record<string, string> = {};
  for (const c of allCategories) {
    categoryTitles[c.slug] = c.title;
  }

  // L1 category slugs (used to group L2s under their parent L1)
  const l1Slugs = allCategories
    .filter((c: any) => c.categoryLevel === 1)
    .map((c: any) => c.slug as string);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Featured Apps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track which apps appear in featured/recommended sections on the{" "}
          {platformName}.
        </p>
      </div>

      <FeaturedTabs
        homeSightings={homeData.sightings}
        trackedSlugs={homeData.trackedSlugs}
        competitorSlugs={homeData.competitorSlugs}
        sections={sections}
        categoryOptions={l0Categories}
        categoryTitles={categoryTitles}
        l1Slugs={l1Slugs}
      />
    </div>
  );
}
