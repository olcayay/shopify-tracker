import Link from "next/link";
import { getCategory, getCategoryHistory } from "@/lib/api";
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

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let category: any;
  let history: any;
  try {
    [category, history] = await Promise.all([
      getCategory(slug),
      getCategoryHistory(slug, 10),
    ]);
  } catch {
    return <p className="text-muted-foreground">Category not found.</p>;
  }

  const snapshot = category.latestSnapshot;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{category.title}</h1>
        <p className="text-muted-foreground">
          Level {category.categoryLevel} &middot; {category.slug}
          {category.parentSlug && (
            <>
              {" "}
              &middot; Parent:{" "}
              <Link
                href={`/categories/${category.parentSlug}`}
                className="text-primary hover:underline"
              >
                {category.parentSlug}
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Children */}
      {category.children?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subcategories ({category.children.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {category.children.map((child: any) => (
                <Link key={child.slug} href={`/categories/${child.slug}`}>
                  <Badge variant="outline" className="cursor-pointer">
                    {child.title}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest Snapshot */}
      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">App Count</div>
                <div className="text-xl font-semibold">
                  {snapshot.appCount ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Scraped At</div>
                <div className="text-sm">
                  {new Date(snapshot.scrapedAt).toLocaleString()}
                </div>
              </div>
              {snapshot.firstPageMetrics && (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Avg Rating
                    </div>
                    <div className="text-xl font-semibold">
                      {snapshot.firstPageMetrics.avg_rating?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Avg Reviews
                    </div>
                    <div className="text-xl font-semibold">
                      {snapshot.firstPageMetrics.avg_review_count?.toFixed(0) ??
                        "—"}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* First Page Apps */}
            {snapshot.firstPageApps?.length > 0 && (
              <>
                <h3 className="font-semibold mt-4">
                  First Page Apps ({snapshot.firstPageApps.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Reviews</TableHead>
                      <TableHead>BFS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.firstPageApps.map((app: any, i: number) => (
                      <TableRow key={app.slug}>
                        <TableCell>{app.position || i + 1}</TableCell>
                        <TableCell>
                          <Link
                            href={`/apps/${app.slug}`}
                            className="text-primary hover:underline"
                          >
                            {app.name}
                          </Link>
                          {app.is_sponsored && (
                            <Badge variant="secondary" className="ml-2">
                              Ad
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{app.rating?.toFixed(1) ?? "—"}</TableCell>
                        <TableCell>{app.review_count ?? "—"}</TableCell>
                        <TableCell>
                          {app.built_for_shopify ? "Yes" : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history?.snapshots?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History ({history.total} snapshots)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>App Count</TableHead>
                  <TableHead>First Page Apps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.snapshots.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {new Date(s.scrapedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{s.appCount ?? "—"}</TableCell>
                    <TableCell>{s.firstPageApps?.length ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
