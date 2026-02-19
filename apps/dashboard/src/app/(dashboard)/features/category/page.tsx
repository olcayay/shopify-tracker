import Link from "next/link";
import { getFeaturesByCategory, getAccountStarredFeatures } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StarFeatureButton } from "../[handle]/track-button";

export default async function FeaturesByCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subcategory?: string }>;
}) {
  const { category, subcategory } = await searchParams;

  if (!category && !subcategory) {
    return <p className="text-muted-foreground">No category specified.</p>;
  }

  let features: any[] = [];
  let starredFeatures: any[] = [];
  try {
    [features, starredFeatures] = await Promise.all([
      getFeaturesByCategory(category, subcategory),
      getAccountStarredFeatures().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Failed to load features.</p>;
  }

  const starredHandles = new Set(starredFeatures.map((f: any) => f.featureHandle));

  const title = subcategory
    ? `${category ? `${category} > ` : ""}${subcategory}`
    : category!;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/features" className="hover:underline">
            Features
          </Link>
          {" > "}
          {category && subcategory ? (
            <>
              <Link
                href={`/features/category?category=${encodeURIComponent(category)}`}
                className="hover:underline"
              >
                {category}
              </Link>
              {" > "}
              <span>{subcategory}</span>
            </>
          ) : (
            <span>{category || subcategory}</span>
          )}
        </p>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          {features.length} feature{features.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          {features.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  {!subcategory && <TableHead>Subcategory</TableHead>}
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f: any) => {
                  const isStarred = starredHandles.has(f.handle);
                  return (
                    <TableRow key={f.handle} className={isStarred ? "border-l-2 border-l-yellow-400 bg-yellow-400/5" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/features/${encodeURIComponent(f.handle)}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {f.title}
                          </Link>
                          {isStarred && (
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                      </TableCell>
                      {!subcategory && (
                        <TableCell className="text-sm text-muted-foreground">
                          {f.subcategory_title || "\u2014"}
                        </TableCell>
                      )}
                      <TableCell>
                        <StarFeatureButton
                          featureHandle={f.handle}
                          featureTitle={f.title}
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
