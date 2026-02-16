import Link from "next/link";
import { getFeaturesByCategory, getAccountTrackedFeatures } from "@/lib/api";
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
import { TrackFeatureButton } from "../[handle]/track-button";

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
  let trackedFeatures: any[] = [];
  try {
    [features, trackedFeatures] = await Promise.all([
      getFeaturesByCategory(category, subcategory),
      getAccountTrackedFeatures().catch(() => []),
    ]);
  } catch {
    return <p className="text-muted-foreground">Failed to load features.</p>;
  }

  const trackedHandles = new Set(trackedFeatures.map((f: any) => f.featureHandle));

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
                  const isTracked = trackedHandles.has(f.handle);
                  return (
                    <TableRow key={f.handle} className={isTracked ? "border-l-2 border-l-primary bg-primary/5" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/features/${encodeURIComponent(f.handle)}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {f.title}
                          </Link>
                          {isTracked && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary text-primary">
                              Tracked
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {!subcategory && (
                        <TableCell className="text-sm text-muted-foreground">
                          {f.subcategory_title || "\u2014"}
                        </TableCell>
                      )}
                      <TableCell>
                        <TrackFeatureButton
                          featureHandle={f.handle}
                          featureTitle={f.title}
                          initialTracked={isTracked}
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
