import Link from "next/link";
import { ExternalLink, Bookmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAccountStarredFeatures,
  getFeatureCategoryDetail,
} from "@/lib/api";
import { StarFeatureButton } from "../../[handle]/track-button";
import { buildFeatureSubcategoryPath } from "@/lib/feature-category-links";
import type { PlatformId } from "@appranks/shared";

export default async function FeatureCategoryDetailPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let category: any;
  let starredFeatures: any[] = [];
  try {
    [category, starredFeatures] = await Promise.all([
      getFeatureCategoryDetail(slug, platform as PlatformId),
      getAccountStarredFeatures(platform as PlatformId).catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Feature category not found.</p>;
  }

  const starredHandles = new Set(starredFeatures.map((feature: any) => feature.featureHandle));

  // Sort starred features to top, preserving original order within each group
  const sortedFeatures = [...(category.features || [])].sort((a: any, b: any) => {
    const aStarred = starredHandles.has(a.handle) ? 0 : 1;
    const bStarred = starredHandles.has(b.handle) ? 0 : 1;
    return aStarred - bStarred;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link href={`/${platform}/features`} className="hover:underline">
              Features
            </Link>
            {" > "}
            <span>{category.title}</span>
          </p>
          <h1 className="text-2xl font-bold">{category.title}</h1>
          <p className="text-muted-foreground mt-1">
            {category.featureCount} feature{category.featureCount !== 1 ? "s" : ""} across{" "}
            {category.subcategoryCount} subcategor{category.subcategoryCount === 1 ? "y" : "ies"}
          </p>
        </div>
        {category.url && (
          <a
            href={`${category.url.replace(/\/+$/, "")}/all`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors shrink-0"
            title="Open in marketplace"
          >
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subcategories ({category.subcategories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {category.subcategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {category.subcategories.map((subcategory: any) => (
                <Link
                  key={subcategory.title}
                  href={buildFeatureSubcategoryPath(platform, category.title, subcategory.title)}
                >
                  <Badge variant="outline" className="cursor-pointer">
                    {subcategory.title} ({subcategory.featureCount})
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subcategories found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Features ({category.features.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {category.features.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead className="text-right">Apps</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFeatures.map((feature: any) => {
                  const isStarred = starredHandles.has(feature.handle);

                  return (
                    <TableRow
                      key={feature.handle}
                      className={isStarred ? "border-l-2 border-l-amber-500 bg-amber-500/5" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/${platform}/features/${encodeURIComponent(feature.handle)}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {feature.title}
                          </Link>
                          {isStarred && (
                            <Bookmark className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link
                          href={buildFeatureSubcategoryPath(platform, category.title, feature.subcategoryTitle)}
                          className="hover:underline"
                        >
                          {feature.subcategoryTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {feature.appCount ?? 0}
                      </TableCell>
                      <TableCell>
                        <StarFeatureButton
                          featureHandle={feature.handle}
                          featureTitle={feature.title}
                          initialStarred={isStarred}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No features found in this category.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
