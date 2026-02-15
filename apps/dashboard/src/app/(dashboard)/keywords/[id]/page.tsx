import Link from "next/link";
import { getKeyword, getKeywordRankings } from "@/lib/api";
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

export default async function KeywordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const keywordId = parseInt(id, 10);

  let keyword: any;
  let rankings: any;
  try {
    [keyword, rankings] = await Promise.all([
      getKeyword(keywordId),
      getKeywordRankings(keywordId),
    ]);
  } catch {
    return <p className="text-muted-foreground">Keyword not found.</p>;
  }

  const snapshot = keyword.latestSnapshot;
  const apps = snapshot?.results || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">&ldquo;{keyword.keyword}&rdquo;</h1>
        <p className="text-muted-foreground">
          {snapshot?.totalResults?.toLocaleString() ?? "?"} total results
          {snapshot?.scrapedAt && (
            <>
              {" "}
              &middot; Last scraped:{" "}
              {new Date(snapshot.scrapedAt).toLocaleDateString()}
            </>
          )}
        </p>
      </div>

      {/* Search Results */}
      <Card>
        <CardHeader>
          <CardTitle>Search Results ({apps.length} apps)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Sponsored</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app: any) => (
                <TableRow key={app.app_slug}>
                  <TableCell className="font-mono">{app.position}</TableCell>
                  <TableCell>
                    <Link
                      href={`/apps/${app.app_slug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {app.app_name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {app.short_description}
                    </p>
                  </TableCell>
                  <TableCell>{app.average_rating?.toFixed(1) ?? "—"}</TableCell>
                  <TableCell>
                    {app.rating_count?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell>
                    {app.is_sponsored ? (
                      <Badge variant="secondary">Ad</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ranking History */}
      {rankings?.rankings?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.rankings.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Link
                        href={`/apps/${r.appSlug}`}
                        className="text-primary hover:underline"
                      >
                        {r.appSlug}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">#{r.position}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.scrapedAt).toLocaleDateString()}
                    </TableCell>
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
